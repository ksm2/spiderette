const url = require('url');
const request = require('request');
const { JSDOM } = require('jsdom');

class Page {
  /**
   * @param {Url} urlInfo
   * @param {IncomingMessage} response
   */
  constructor(urlInfo, response) {
    this.urlInfo = urlInfo;
    this.response = response;
  }

  /**
   * @return {Url[]}
   */
  getOutgoingLinks() {
    const dom = this.getDOM();
    const anchors = dom.window.document.querySelectorAll('a[href]');

    const links = [];
    for (const anchor of anchors) {
      const next = url.parse(url.resolve(this.urlInfo.href, anchor.href));
      // Not an HTTP resource?
      if (next.protocol === null || !next.protocol.match(/^https?:$/)) continue;

      links.push(next);
    }

    return links;
  }

  /**
   * @return {JSDOM}
   */
  getDOM() {
    if (!this.dom) this.dom = new JSDOM(this.response.body);
    return this.dom;
  }

  /**
   * @return {string}
   */
  getUrl() {
    return url.format(Object.assign({}, this.urlInfo, { hash: null }));
  }

  /**
   * @return {string}
   */
  getPathname() {
    return this.urlInfo.pathname;
  }

  /**
   * @return {number}
   */
  getStatusCode() {
    return this.response.statusCode;
  }

  /**
   * @param {string} name
   * @return {undefined|string}
   */
  getHeader(name) {
    return this.response.headers[name];
  }

  /**
   * @return {boolean}
   */
  isRedirect() {
    return this.response.statusCode >= 300 && this.response.statusCode < 400;
  }

  /**
   * @return {boolean}
   */
  isClientError() {
    return this.response.statusCode >= 400 && this.response.statusCode < 500;
  }

  /**
   * @return {boolean}
   */
  isServerError() {
    return this.response.statusCode >= 500 && this.response.statusCode < 600;
  }
}

exports.Page = Page;
