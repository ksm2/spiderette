const url = require('url');
const chalk = require('chalk');
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
    this.outgoingPages = [];
    this.incomingPages = [];
  }

  /**
   * @return {Url[]}
   */
  getOutgoingLinks() {
    if (!this.isHTML()) {
      return [];
    }

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
   * @param {Page} page
   */
  addIncomingPage(page) {
    this.incomingPages.push(page);
  }

  /**
   * @param {Page} page
   */
  addOutgoingPage(page) {
    this.outgoingPages.push(page);
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

  isHTML() {
    const contentType = this.response.headers['content-type'] || 'text/html';
    return contentType.match(/^text\/html/);
  }

  /**
   * @return {boolean}
   */
  isSuccess() {
    return this.response.statusCode >= 100 && this.response.statusCode < 300;
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

  log() {
    let str;
    if (this.isRedirect()) {
      str = chalk.bgYellow.black(this.getStatusCode());
    } else if (this.isClientError()) {
      str = chalk.bgRed.white(this.getStatusCode());
    } else if (this.isServerError()) {
      str = chalk.bgBlack.red(this.getStatusCode());
    } else {
      str = chalk.bgGreen.black(this.getStatusCode());
    }

    str += ` ${this.getUrl()}`;
    return str;
  }
}

exports.Page = Page;
