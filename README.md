Spiderette
==========
An automated spider test runner for your website.

## Installation

Install using NPM:
```bash
$ npm install --global spiderette
```

## Example

Test a local website:
```bash
$ spiderette http://127.0.0.1:8000
```

If any 4XX references were found, Spiderette will return with a status code 1. 
