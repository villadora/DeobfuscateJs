"use strict"

var U2 = require('uglify-js'),
vm = require('vm'),
path = require('path'),
fs = require('fs'),
Replacement = require('./replaces'),
replacename = Replacement.replacename
;

// import all AST_* structures
(function() {
    for (var key in U2) {
        if(/^AST_/.test(key))
            global[key] = U2[key];
        else if (/^Tree/.test(key))
            global[key] = U2[key];
    }
})();


['U2/util.js','U2/parse.js', 'travese.js'].forEach(function(file) {
    var code = fs.readFileSync(path.join(__dirname, file), "utf8");
    vm.runInThisContext(code, path.basename(file));
});


// InlineFunction class
function InlineFunction(options) {
    if(!(this instanceof InlineFunction))
        return new InlineFunction(options);
    this.options = defaults(options, {});
    TreeTransformer.call(this, this.before, this.after);
}

module.exports = InlineFunction;

InlineFunction.prototype = new TreeTransformer;

merge(InlineFunction.prototype,  {
    option: function(key) { return this.options[key] },
    before: function(topLevel) {
        var fnames = this.option('fnames'), aggressive = this.option('aggressive');
        var l = 1;
        var linkTw = new TreeWalker(function(node) {
            var p = linkTw.parent();
            node._parent = p;
            if(node instanceof AST_Defun) {
                var symDefun = node.name;
                if(symDefun.thedef.defun) 
                    console.warn("\"defun\" already exists, name: %s, line:%s, col:%s", symDefun.thedef.name, symDefun.thedef.defun.start.line, symDefun.thedef.defun.start.col); 
                symDefun.thedef.defun = node; // relink back
                // find recursion
                var recursion = false;
                node.body.forEach(function(e) {
                    e.travel(function(prop, elm) {
                        if(elm.thedef == symDefun.thedef)
                            recursion = true;
                    });
                });

                if(!recursion && (aggressive || fnames.indexOf(symDefun.name) != -1)) {
                    // if the function use arguments array, then do not inline
                    node._inlined = !node.uses_arguments && true; 
                }
            }
        });
        
        topLevel.walk(linkTw);


        var tw = new TreeWalker(function(node, descend) {
            if(node instanceof AST_Call) {
                var exp = node.expression, args = node.args;

                if(exp instanceof AST_SymbolRef) {
                    if(exp.thedef.orig.length < 2) { // do not inline functions with multiple definitions
                        var defun = exp.thedef.defun;
                        if(defun && defun._inlined) { // sometimes the reassignment will break the re-link, need more on static analysis
                            if(defun.body.length > 0 && defun.body.length < 2) { // do not inline functions that more than one statement or empty function

                                var argnames = defun.argnames;
                                var funargDefs = [];
                                argnames.forEach(function(arg) {
                                    funargDefs.push(arg.thedef);
                                });

                                // fill the argments if its undefined
                                while(argnames.length !== args.length) {
                                    args.push(make_node_from_constant(undefined));
                                }

                                var smt = defun.body[0], p = node._parent, body;
                                if(smt instanceof AST_Return) {
                                    body = smt.value.deepClone();
                                }else if (smt instanceof AST_SimpleStatement) {
                                    body = smt.body.deepClone();
                                }else if(smt instanceof AST_Throw) {
                                    body = smt.deepClone();
                                }else { // Does not handle other situation yet
                                    return;
                                }

                                var pass = false;


                                switch(p.TYPE) {
                                case 'Seq':
                                    if(p.cdr === node) 
                                        p.cdr[replacename] = body;
                                    else if(p.car === node) 
                                        p.car[replacename] = body;
                                    break;
                                case 'SimpleStatement':
                                    if(body == null) { // in return
                                        p[replacename] == make_node_from_constant(null);
                                    }else {
                                        p[replacename] = make_node(AST_SimpleStatement, p, {
                                            body: body
                                        });
                                    }
                                    break;
                                case 'Binary':
                                    if(p.left === node) 
                                        p.left[replacename] = body;
                                    else if(p.right === node)
                                        p.right[replacename] = body;
                                    break;
                                case 'Conditional':
                                    if(p.condition === node) 
                                        p.condition[replacename] = body;
                                    else if(p.consequent === node)
                                        p.consequent[replacename] = body;
                                    else if(p.alternative === node)
                                        p.alternative[replacename] = body;
                                    break;
                                case 'Assign':
                                    if(p.right == node){
                                        p.right[replacename] = body;
                                    }else
                                        pass = true;
                                    break;
                                case 'VarDef':
                                    if(p.value == node)
                                        p.value[replacename] = body;
//                                    pass = true;
                                    break;
                                case 'Call':
                                    var len = p.args.length;
                                    for(var i = 0; i < len; ++i) {
                                        if(p.args[i] == node) {
                                            p.args[i][replacename] = body;
                                            break;
                                        }
                                    }
                                    break;
                                default:
                                    // other inline may cause side effect and return behaviour is not determinded
                                    // console.info("Default Case Type: %s", p.TYPE);
                                    pass = true;
                                    break;
                                }

                                if(!pass) {
                                    if(defun.start.comments_before) {
                                        var comments = defun.start.comments_before;
                                        if(comments.length == 0 || !(comments[comments.length-1].injected))
                                            comments.push({value:"inlined", type:"comment2",injected:true});
                                    }

                                    // replace the variables in the body
                                    // console.log(defun.name.name, node.start.line);

                                    body.travel(function(prop, elm) {
                                        if(elm instanceof AST_SymbolRef) {
                                            var idx =  funargDefs.indexOf(elm.thedef); 
                                            if(idx != -1) { // this is define in funargs
                                                this[prop] = args[idx].deepClone();
                                            }
                                        }
                                    });
                                }

                            }
                        }
                    }
                }
            }
        });

        topLevel.walk(tw);
        return topLevel.transform(new Replacement());
    }
});
