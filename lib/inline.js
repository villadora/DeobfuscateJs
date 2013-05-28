// InlineFunction class
function InlineFunction(options) {
    if(!(this instanceof InlineFunction))
        return new InlineFunction(options);

    this.options = defaults(options, {
        'fnames':[]
    });
    
    TreeTransformer.call(this, this.before, this.after);
}


InlineFunction.prototype = new TreeTransformer;

merge(InlineFunction.prototype,  {
    option: function(key) { return this.options[key] },
    before: function(topLevel) {
        var fnames = this.option('fnames'), aggressive = this.option('aggressive');

        var linkTw = new TreeWalker(function(node) {
            var p = linkTw.parent();
            node._parent = p;
            if(node instanceof AST_Defun) {
                var symDefun = node.name;
                if(symDefun.thedef.defun) console.warn('"defun" already exists'); 
                symDefun.thedef.defun = node; // relink back
                if(fnames.indexOf(symDefun.name) != -1)
                    node._inlined = !node.uses_arguments && true;
            }
        });
        
        topLevel.walk(linkTw);


        var tw = new TreeWalker(function(node, descend) {
            if(node instanceof AST_Call) {
                var exp = node.expression, args = node.args;

                if(exp instanceof AST_SymbolRef) {
                    if(exp.thedef.orig.length < 2) { // do not inline functions with multiple definitions
                        var defun = exp.thedef.defun;
                        if(defun && (defun._inlined || aggressive)) { // sometimes the reassignment will break the re-link, need more on static analysis
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
                                }else { // Does not handle other situation yet
                                    return;
                                }

                                switch(p.TYPE) {
                                    case 'Seq':
                                    if(p.cdr === node) {
                                        p.cdr['_replaced'] = body;
                                    }else if(p.car === node) {
                                        p.car['_replaced'] = body;
                                    }
                                    break;
                                    case 'SimpleStatement':
                                    if(body == null) { // in return
                                        p['_replaced'] == make_node_from_constant(null);
                                    }else {
                                        p['_replaced'] = make_node(AST_SimpleStatement, p, {
                                            body: body
                                        });
                                    }
                                    break;
                                    default:
                                    // other inline may cause side effect and return behaviour is not determinded
                                    break;
                                }

                                // replace the variables in the body
                                body.travel(function(prop, elm) {
                                    if(elm instanceof AST_SymbolRef) {
                                        var idx =  funargDefs.indexOf(elm.thedef); 
                                        if(idx != -1) { // this is define in funargs
                                            this[prop] = args[idx].clone();
                                        }
                                    }
                                });

                            }
                        }
                    }
                }
            }
        });

        topLevel.walk(tw);

        var tt = new TreeTransformer(function(node, descend) {
            if(node.hasOwnProperty('_replaced')) {
                var rep =  node['_replaced'];
                delete node['_replaced'];
                return rep;
            }
            descend(node, this);
            return node;
        });

        topLevel.transform(tt);

        return topLevel;
    }
});
