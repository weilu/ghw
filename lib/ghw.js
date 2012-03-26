var fs = require('fs');
var marked = require('marked');

exports.transform = transform;
exports.transformers = transformers();

function transform(f, transformers, done) {
    fs.readFile(f, 'utf-8', function(err, data) {
        if (err) throw err;

        var tokens = marked.lexer(data).map(function(t) {
            if(t.type == 'text' || t.type == 'paragraph') {
                var text = t.text;

                for(var k in transformers) {
                    var v = transformers[k];
                    text = v.match(text, v.toHTML);
                }

                return {
                    type: 'text',
                    text: text
                };
            }
            return t;
        });
        tokens.links = [];

        done(f, marked.parser(tokens));
    });
}

// http://phpjs.org/functions/rtrim:507
function rtrim(str, charlist) {
    charlist = !charlist ? ' \\s\u00A0' : (charlist + '').replace(/([\[\]\(\)\.\?\/\*\{\}\+\$\^\:])/g, '\\$1');
    var re = new RegExp('[' + charlist + ']+$', 'g');
    return (str + '').replace(re, '');
}

function all(o) {
    for(var i = 0, len = o.length; i < len; i++) {
        if(!o[i]) return false;
    }

    return true;
}

function transformers() {
    function tableToAST(header, align, lines) {
        // TODO: split up header, align, lines now
        return {
            header: header.split('|'),
            align: align.split('|').map(function(p) {
                if(p[0] == ':' && p[p.length - 1] == ':') return 'center';
                if(p[p.length - 1] == ':') return 'right';
                return 'left';
            }),
            lines: lines.map(function(line) { return rtrim(line, '|').split('|');})
        };
    }

    return attachMissing({
        table: {
            match: function(text, output) {
                var parts = text.split('\n');

                if(parts.length < 2) return text;

                var header = parts[0];
                var align = parts[1];
                var lines = parts.slice(2);

                var cols = header.split('|').length;
                if(cols < 2) return text;
                if(cols != align.split('|').length) return text;
                if(all(lines.map(function(v) {return v.indexOf('|') >= 0;})))

                return output(tableToAST(header, align, lines));
            },
            toAST: tableToAST,
            toHTML: function() {} // TODO
        },
        bracket_pipe_link: {
            pattern: /\[\[([^\|]+)\|([^\]]+)\]\]/g,
            toHTML: function(o) {
                var suffix = o.r.match('^http')? '': '.html';

                return '<a href="' + o.r.replace(' ', '-') + suffix + '">' + o.l + '</a>';
            }
        },
        pipe_link: {
            pattern: /\[([^\|]+)\|([^\]]+)\]/g,
            toHTML: function(o) {
                return '<a href="' + o.r.replace(' ', '-') + '">' + o.l + '</a>';
            }
        },
        bracket_link: {
            pattern: /\[\[([^\]]+)\]\]/g,
            toHTML: function(o) {
                return '<a href="' + o.l.replace(' ', '-')  + '.html">' + o.l + '</a>';
            }
        },
        paragraphs: {
            toHTML: function(o) {
                return '<p>' + o.l.split('\n').filter(id).join('</p><p>') + '</p>';
            }
        }
    });

    function attachMissing(o) {
        for(var k in o) {
            var v = o[k];

            attachMatch(v);
            attachToAST(v);
        }

        function attachMatch(v) {
            if(v.match) return;

            if(v.pattern) {
                v.match = function(text, output) {
                    output = output || function(o) {return o;};

                    return text.replace(v.pattern, function(orig, l, r) {
                        return output(v.toAST(l, r));
                    });
                };
            }
            else {
                v.match = function(text, output) {
                    return output(v.toAST(text));
                };
            }
        }

        function attachToAST(v) {
            if(!v.toAST) {
                v.toAST = function(l, r) {
                    return {'l': l, 'r': r};
                }
            }
        }

        return o;
    }
}

function id(a) {
    return a;
}
