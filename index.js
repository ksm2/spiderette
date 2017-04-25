const url = require('url');
const request = require('request');
const jsdom = require('jsdom');
const chalk = require('chalk');
const { JSDOM } = jsdom;

exports.Spiderette = class Spiderette {
  constructor(options) {

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

    this.runInternalURL(urlInfo, null, []).then((ok) => {
      process.exit(ok ? 0 : 1);
    });
  }

  /**
   * Runs the test on an URL
   *
   * @param {{ href: string, host: string, pathname: string }} href
   * @param {string|null} from
   * @param {string[]} resolvedPaths
   * @return {Promise<boolean>}
   */
  runInternalURL(href, from, resolvedPaths) {
    if (resolvedPaths.indexOf(href.pathname) >= 0) return Promise.resolve(true);
    resolvedPaths.push(href.pathname);

    return this.getResource(href)
      .then((resp) => {
        const statusCode = resp.statusCode;

        // is redirect
        if (statusCode >= 300 && statusCode < 400) {
          console.log(`${chalk.bgYellow.black(statusCode)} ${href.pathname} ${chalk.gray(`(from ${from})`)}`);
          const next = url.parse(url.resolve(href.href, resp.headers.location));
          return this.runInternalURL(next, from, resolvedPaths);
        }

        // is error
        if (statusCode >= 400) {
          console.log(`${chalk.bgRed.white(statusCode)} ${href.pathname} ${chalk.gray(`(from ${from})`)}`);
          return Promise.resolve(false);
        }

        const dom = new JSDOM(resp.body);
        const anchors = dom.window.document.querySelectorAll('a[href]');

        const p = [];
        for (const anchor of anchors) {
          const next = url.parse(url.resolve(href.href, anchor.href));
          if (next.protocol === null || !next.protocol.match(/^https?:$/)) continue;

          if (next.host === href.host) {
            p.push(this.runInternalURL(next, href.pathname, resolvedPaths));
          }
        }

        return Promise.all(p).then(booleans => booleans.every(bool => bool));
      })
      .catch(() => {
        return true;
      })
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
