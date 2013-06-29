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
function ConstantReplaces(options) {
    if(!(this instanceof ConstantReplaces))
        return new ConstantReplaces(options);

    this.options = defaults(options, {});

    TreeTransformer.call(this, this.before, this.after);
}

module.exports = ConstantReplaces;

ConstantReplaces.prototype = new TreeTransformer;


merge(ConstantReplaces.prototype,  {
    option: function(key) { return this.options[key] },
    before: function(topLevel) {
        var constants = this.option('constants'), nogetset = this.option('nogetset'), aggressive = this.option('aggressive');

        var walk = new TreeWalker(function(node) {
            if(node instanceof AST_Scope) {
                // symbol inline!!
                var defOutside = [];
                node.enclosed.forEach(function(def) {
                    defOutside.push(def);
                });
                node.variables.each(function(def) {
                    var idx = defOutside.indexOf(def);
                    if(idx !== -1) 
                        defOutside.splice(idx, 1);
                });

                defOutside.forEach(function(def) {
                    if(def.orig.length > 1) {
                        // currently it's not safe to handle this situation
                    }else {
                        // Because uglifyJs provides no CFG and point all the references into on definition, that assignmens are no reliable
                        def.outside = true;
                        // a symbol is not replacable only when it reassigned in the scope but it defined out the scope
                        // this reference chain can be dectected by CFG.
                        // TODO: generate CFG with esprima
                    }
                });
            }else if(node instanceof AST_Assign) {
                // find if a symbol is used as a left value
                var left = node.left, right = node.right;
                if(left instanceof AST_SymbolRef) {
                    left.thedef.asLeft = true;
                    left.thedef.modified = true;
                }else if(left instanceof AST_PropAccess) {
                    left.travel(function(prop, elm) {
                        if(prop == 'expression') {
                            if(elm instanceof AST_SymbolRef) {
                                elm.thedef.asLeft = true;
                            }
                        }
                    });
                }
            }
        });

        topLevel.walk(walk);

        var tw = new TreeWalker(function(node){
            if(node instanceof AST_VarDef) {
                var name = node.name, value = node.value;
                var prefix = "$d_";
                if(name.thedef.orig.length > 1 || name.thedef.modified) {
                    // it's unsafe to replace those symbols that defined multiple times
                    name.thedef.orig.forEach(function(decl) {
                        // decl is SymbolVar, the same as name
                        // decl's parent is VarDef should be emptyStatement
                    });
                    return;
                }
                
                if(value) {
                    var value_str = value.print_to_string();
                    if(constants.hasOwnProperty(value_str)) {
                        // 1. empty declaration is not nessecary
                        name.thedef.mangled_name = prefix+constants[value_str];
                        if(name.thedef.orig.length > 1) {
                            throw new Error("the decleration should not be used anywhere else for a minified code");
                        }
                        
                        // 2. Replace references
                        name.thedef.references.forEach(function(ref){
                            // ref is SymbolRef
                            ref[replacename] = make_node_from_constant(constants[value_str], ref);
                        });
                    }else if (value instanceof AST_SymbolRef && (value_str != 'arguments') &&(value.thedef.outside || value.thedef.undeclared)){ // replace all the reassignments for global variables
                        // in a single merged js, any undeclared variables are either builtin variables like 'window', etc. or global variables that imported from another js file
                        name.thedef.mangled_name = prefix+value_str;
                        name.thedef.references.forEach(function(ref) {
                            ref[replacename] = value.hasOwnProperty(replacename) ? value[replacename].clone() : value.clone();
                        });
                    }else if(value instanceof AST_This && !name.thedef.mangeld_name) {
                        // change to self
                        name.thedef.mangled_name = 'self';
                    }else if(value instanceof AST_SymbolRef && (value_str != 'arguments') && (!value.thedef.modified)) {
                        name.thedef.mangled_name = prefix+value_str;
                        name.thedef.references.forEach(function(ref) {
                            ref[replacename] = value.hasOwnProperty(replacename) ? value[replacename].clone() : value.clone();
                        });
                    }else if (nogetset && value instanceof AST_PropAccess) { // !name.thedef.outside
                        // Important! if there are syntax that enable 'get'/'set' in javascript, the PropAcess will have side effect; so once you have 'get'/'set' in code, it's very dangous to make it as inline
                        name.thedef.mangled_name = prefix+name.thedef.name;
                        name.thedef.references.forEach(function(ref) {
                            ref[replacename] = value.hasOwnProperty(replacename) ? value[replacename].deepClone() : value.deepClone();
                        });
                    }else if(value instanceof AST_SimpleStatement){
                    }else if(value instanceof AST_String) {
                        name.thedef.mangled_name = prefix + name.thedef.name;
                        name.thedef.references.forEach(function(ref) {
                            ref[replacename] = make_node_from_constant(value.value);
                        });
                    }else {
                    }
                }
                
            }else if(aggressive){
                var value_str = node.print_to_string();
                if(!(node instanceof AST_String) &&  constants.hasOwnProperty(value_str)) {
                    node[replacename] = make_node_from_constant(constants[value_str], node);
                }
            }
        });

        topLevel.walk(tw);
        return topLevel.transform(new Replacement());
    }
});
