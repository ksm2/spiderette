const url = require('url');
const chalk = require('chalk');
const request = require('request');
const { Page } = require('./Page');

class Spiderette {
  constructor(options) {
    this.options = Object.assign({
      internal: false,
      verbose: false,
      ignoreRedirect: false,
      ignoreClient: false,
      ignoreServer: false
    }, options);
    this.pages = new Map();
  }

  /**
   * Runs the test on an URL
   *
   * @param {string} href
   */
  runURL(href) {
    const urlInfo = url.parse(href);
    const { host, pathname } = urlInfo;
    process.stderr.write(`${chalk.yellow('Host:')}          ${host}\n`);
    process.stderr.write(`${chalk.yellow('Start Path:')}    ${pathname}\n`);

    let exitCode;
    return this.loadPage(urlInfo)
      .then((page) => {
        return this.analyzePage(page, [], true);
      })
      .then((ok) => {
        exitCode = ok ? 0 : 1;
        // Resolve all pages
        return Promise.all([...this.pages.values()].map(p => p.catch(() => null))).then(a => a.filter(b => b));
      })
      .then((pages) => {
        // Do some logging
        process.stderr.write(`${chalk.yellow('Pages:')}         ${pages.length}\n`);
        const successful = pages.filter(page => page.isSuccess());
        process.stderr.write(`${chalk.yellow('Success:')}       ${successful.length} (${100 * successful.length / pages.length} %)\n`);
        const server = pages.filter(page => page.isServerError());
        process.stderr.write(`${chalk.yellow('Server Errors:')} ${server.length}\n`);
        const clients = pages.filter(page => page.isClientError());
        process.stderr.write(`${chalk.yellow('Client Errors:')} ${clients.length}\n`);
        const redirects = pages.filter(page => page.isRedirect());
        process.stderr.write(`${chalk.yellow('Redirects:')}     ${redirects.length}\n`);

        // Create and output a text report
        const report = this.createReport(pages);
        for (const [outgoingPages, incomingPages] of report) {
          for (const page of outgoingPages) {
            process.stdout.write(`${chalk.gray('<-')} ${page.log()}\n`);
          }
          for (const page of incomingPages) {
            process.stdout.write(`${chalk.gray('->')} ${page.log()}\n`);
          }
          process.stdout.write('\n');
        }

        process.exit(exitCode);
      });
  }

  /**
   * Creates the page index
   *
   * @param {Page[]} allPages
   * @return {Map<Page[], Page[]>}
   */
  createReport(allPages) {
    const pageIndex = [];
    for (const page of allPages) {
      if (page) {
        this.indexPage(page, pageIndex);
      }
    }

    return new Map(pageIndex.sort((a, b) => b[0].length - a[0].length));
  }

  /**
   * Indexes a page
   *
   * @param {Page} page
   * @param {Array<Page[], Page[]>} pageIndex
   * @return {boolean}
   */
  indexPage(page, pageIndex) {
    if (page.isRedirect() && this.options.ignoreRedirect) {
      return false;
    }

    if (page.isClientError() && this.options.ignoreClient) {
      return false;
    }

    if (page.isServerError() && this.options.ignoreServer) {
      return false;
    }

    if (page.isSuccess() && !this.options.verbose) {
      return false;
    }

    const incoming = page.incomingPages.sort((a, b) => a.getUrl().localeCompare(b.getUrl())).filter((item, pos, self) => {
      return self.indexOf(item) === pos;
    });

    let added = false;
    for (const [key, items] of pageIndex) {
      if (this.arraysEqual(key, incoming)) {
        items.push(page);
        added = true;
        break;
      }
    }

    if (!added) {
      pageIndex.push([incoming, [page]]);
    }

    return true;
  }

  /**
   * Runs the test on an URL
   *
   * @param {Page} page
   * @param {string[]} resolvedPaths
   * @param {boolean} loadChildren
   * @return {Promise<boolean>}
   */
  analyzePage(page, resolvedPaths, loadChildren) {
    if (resolvedPaths.indexOf(page.getUrl()) >= 0) return Promise.resolve(true);
    resolvedPaths.push(page.getUrl());

    // Perform and log the redirect
    if (page.isRedirect()) {
      const next = url.parse(url.resolve(page.getUrl(), page.getHeader('location')));
      next.hash = page.urlInfo.hash;
      return this.loadPage(next).then((nextPage) => {
        page.addOutgoingPage(nextPage);
        nextPage.addIncomingPage(page);
        return this.analyzePage(nextPage, resolvedPaths, loadChildren)
      });
    }

    // Log the client error
    if (page.isClientError() || page.isServerError()) {
      return Promise.resolve(false);
    }

    // Stop here if no children should be loaded
    if (!loadChildren) return Promise.resolve(true);

    const p = [];
    for (const link of page.getOutgoingLinks()) {
      const isInternal = link.host === page.urlInfo.host;
      if (isInternal || !this.options.internal) {
        p.push(this.loadPage(link).then((outgoingPage) => {
          page.addOutgoingPage(outgoingPage);
          outgoingPage.addIncomingPage(page);
          return this.analyzePage(outgoingPage, resolvedPaths, isInternal);
        }).catch(() => true));
      }
    }

    return Promise.all(p).then(booleans => booleans.every(bool => bool));
  }

  /**
   * @param {Url} urlInfo
   * @return {Promise<Page>}
   */
  loadPage(urlInfo) {
    const reqUrl = this.getCanonicalUrl(urlInfo);
    if (!this.pages.has(reqUrl)) {
      this.pages.set(reqUrl, this.createPageRequest(urlInfo));
    }

    return this.pages.get(reqUrl);
  }

  /**
   * @param {Url} urlInfo
   * @return {Promise}
   */
  createPageRequest(urlInfo) {
    const reqUrl = this.getCanonicalUrl(urlInfo);
    return new Promise((resolve, reject) => {
      request({
        url: reqUrl,
        followRedirect: false,
        gzip: true,
        headers: {
          'Accept': 'text/html',
        }
      }, (err, resp) => {
        if (err) {
          return reject(err);
        }

        resolve(new Page(urlInfo, resp));
      });
    });
  }

  /**
   * @param {Url} urlInfo
   * @return {string}
   */
  getCanonicalUrl(urlInfo) {
    return `${urlInfo.protocol}//${urlInfo.host}${urlInfo.pathname}`;
  }

  /**
   * @param {string[]} a
   * @param {string[]} b
   * @return {boolean}
   */
  arraysEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.length !== b.length) return false;

    a.sort();

    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

exports.Spiderette = Spiderette;
