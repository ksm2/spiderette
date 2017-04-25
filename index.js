const url = require('url');
const request = require('request');
const jsdom = require('jsdom');
const chalk = require('chalk');
const { JSDOM } = jsdom;

exports.Spiderette = class Spiderette {
  constructor(options) {
    this.options = Object.assign({
      internal: false,
      verbose: false,
      ignoreRedirect: false,
      ignoreClient: false,
      ignoreServer: false
    }, options);
    this.logRedirects = !(options.ignoreRedirect || false);
    this.logClientErrors = !(options.ignoreClient || false);
    this.logServerErrors = !(options.ignoreServer || false);
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

    this.analyzeURL(urlInfo, null, [], true).then((ok) => {
      process.exit(ok ? 0 : 1);
    });
  }

  /**
   * Runs the test on an URL
   *
   * @param {{ href: string, host: string, pathname: string }} href
   * @param {string|null} from
   * @param {string[]} resolvedPaths
   * @param {boolean} loadChildren
   * @return {Promise<boolean>}
   */
  analyzeURL(href, from, resolvedPaths, loadChildren) {
    if (resolvedPaths.indexOf(href.href) >= 0) return Promise.resolve(true);
    resolvedPaths.push(href.href);

    return this.getResource(href)
      .then((resp) => {
        const statusCode = resp.statusCode;

        // Perform and log the redirect
        if (statusCode >= 300 && statusCode < 400) {
          if (!this.options.ignoreRedirect) {
            console.log(`${chalk.bgYellow.black(statusCode)} ${href.href} ${chalk.gray(`(from ${from})`)}`);
          }
          const next = url.parse(url.resolve(href.href, resp.headers.location));
          return this.analyzeURL(next, from, resolvedPaths, loadChildren);
        }

        // Log the client error
        if (statusCode >= 400 && statusCode < 500) {
          if (!this.options.ignoreClient) {
            console.log(`${chalk.bgRed.white(statusCode)} ${href.href} ${chalk.gray(`(from ${from})`)}`);
          }
          return false;
        }

        // Log the server error
        if (statusCode >= 500 && statusCode < 600) {
          if (!this.options.ignoreServer) {
            console.log(`${chalk.bgBlack.red(statusCode)} ${href.href} ${chalk.gray(`(from ${from})`)}`);
          }
          return false;
        }

        // Log the success
        if (this.options.verbose) {
          console.log(`${chalk.bgGreen.black(statusCode)} ${href.href} ${chalk.gray(`(from ${from})`)}`);
        }

        // Stop here if no children should be loaded
        if (!loadChildren) return true;

        const dom = new JSDOM(resp.body);
        const anchors = dom.window.document.querySelectorAll('a[href]');

        const p = [];
        for (const anchor of anchors) {
          const next = url.parse(url.resolve(href.href, anchor.href));
          // Not an HTTP resource?
          if (next.protocol === null || !next.protocol.match(/^https?:$/)) continue;

          const isInternal = next.host === href.host;
          if (isInternal || !this.options.internal) {
            p.push(this.analyzeURL(next, href.pathname, resolvedPaths, isInternal));
          }
        }

        return Promise.all(p).then(booleans => booleans.every(bool => bool));
      })
      .catch(() => {
        return true;
      });
  }

  /**
   * @param {{ href: string, host: string, pathname: string }} href
   * @return {Promise<http.IncomingMessage>}
   */
  getResource(href) {
    return new Promise((resolve, reject) => {
      request({
        url: href.href,
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

        resolve(resp);
      });
    });
  }
};
