// https://github.com/mrq-cz/slackify-html
// https://github.com/godolatunji/html-slack/blob/master/lib/rules.js

var htmlparser = require('htmlparser'),
    Entities = require('html-entities').AllHtmlEntities;

entities = new Entities();

module.exports = function slackify(html) {
  var handler = new htmlparser.DefaultHandler(function (error, dom) {
    // error ignored
  });
  var parser = new htmlparser.Parser(handler);
  parser.parseComplete(html);
  var dom = handler.dom;
  if (dom)
    return entities.decode(walk(dom));
  else
    return '';
}

function walk(dom) {
  var out = '';
  if (dom)
    dom.forEach(function (el) {
      if ('text' === el.type) {
        out += el.data;
      }
      if ('tag' === el.type) {
        switch (el.name) {
          case 'a':
            out += '<' + el.attribs.href + '|' + walk(el.children) + '>';
            break;
          case 'strong':
          case 'b':
            out += '*' + walk(el.children) + '*';
            break;
          case 'i':
          case 'em':
            out += '_' + walk(el.children) + '_';
            break;
          case 'code':
          case 'pre':
            out += '`' + walk(el.children) + '`';
            break;
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            out += '*' + walk(el.children) + '*';
            break;
          case 'blockquote':
            out += '_' + walk(el.children) + '_';
            break;
          case 'del':
          case 's':
          case 'strike':
            out += '~' + walk(el.children) + '~';
            break;
          case 'u':
            out += '_' + walk(el.children) + '_';
            break; 
          default:
            out += walk(el.children);
        }
      }
    });
  return out;
}
