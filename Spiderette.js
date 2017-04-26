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
    console.log(`${chalk.yellow('Host:')}       ${host}`);
    console.log(`${chalk.yellow('Start Path:')} ${pathname}`);

    return this.loadPage(urlInfo)
      .then((page) => {
        return this.analyzePage(page, null, [], true);
      })
      .then((ok) => {
        process.exit(ok ? 0 : 1);
      });
  }

  /**
   * Runs the test on an URL
   *
   * @param {Page} page
   * @param {string|null} fromUrl
   * @param {string[]} resolvedPaths
   * @param {boolean} loadChildren
   * @return {Promise<boolean>}
   */
  analyzePage(page, fromUrl, resolvedPaths, loadChildren) {
    if (resolvedPaths.indexOf(page.getUrl()) >= 0) return Promise.resolve(true);
    resolvedPaths.push(page.getUrl());

    // Perform and log the redirect
    if (page.isRedirect()) {
      if (!this.options.ignoreRedirect) {
        console.log(`${chalk.bgYellow.black(page.getStatusCode())} ${page.getUrl()} ${chalk.gray(`(from ${fromUrl})`)}`);
      }
      const next = url.parse(url.resolve(page.getUrl(), page.getHeader('location')));
      next.hash = page.urlInfo.hash;
      return this.loadPage(next).then(nextPage => this.analyzePage(nextPage, fromUrl, resolvedPaths, loadChildren));
    }

    // Log the client error
    if (page.isClientError()) {
      if (!this.options.ignoreClient) {
        console.log(`${chalk.bgRed.white(page.getStatusCode())} ${page.getUrl()} ${chalk.gray(`(from ${fromUrl})`)}`);
      }
      return Promise.resolve(false);
    }

    // Log the server error
    if (page.isServerError()) {
      if (!this.options.ignoreServer) {
        console.log(`${chalk.bgBlack.red(page.getStatusCode())} ${page.getUrl()} ${chalk.gray(`(from ${fromUrl})`)}`);
      }
      return Promise.resolve(false);
    }

    // Log the success
    if (this.options.verbose) {
      console.log(`${chalk.bgGreen.black(page.getStatusCode())} ${page.getUrl()} ${chalk.gray(`(from ${fromUrl})`)}`);
    }

    // Stop here if no children should be loaded
    if (!loadChildren) return Promise.resolve(true);

    const p = [];
    for (const link of page.getOutgoingLinks()) {
      const isInternal = link.host === page.urlInfo.host;
      if (isInternal || !this.options.internal) {
        p.push(this.loadPage(link).then((outgoingPage) => {
            return this.analyzePage(outgoingPage, page.getPathname(), resolvedPaths, isInternal);
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

        const contentType = resp.headers['content-type'] || 'text/html';
        if (!contentType.match(/^text\/html/)) {
          return reject(new Error('Wrong Content-Type: ' + contentType));
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
}

exports.Spiderette = Spiderette;
