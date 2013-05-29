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


// Handle that json file can not have undefined as value
var DEFAULT_CONFIG = require('./config');
DEFAULT_CONFIG["constants"]["void 0"] = undefined;
DEFAULT_CONFIG["constants"]["Infinity"] = Infinity;

/** @const **/ var VERBOSE = DEFAULT_CONFIG["verbose"];



// Deobfuscate class
function Deobfuscate(options) {
    if(!(this instanceof Deobfuscate))
        return new Deobfuscate(options);

    this.options = defaults(options, DEFAULT_CONFIG);
    
    changeDefaultOutputs();
    
    TreeTransformer.call(this, this.before, this.after);
}

Deobfuscate.prototype = new TreeTransformer;

merge(Deobfuscate.prototype, {
    option: function(key) { return this.options[key] },
    before: function(topLevel) {
        var self = this;


        var tw = new TreeWalker(function(node) {
            if(node.deobfuscate) {
                node.deobfuscate(tw);
            }
        });

        tw.options = this.options;

        // walk the ast tree
        topLevel.walk(tw);

        return topLevel.transform(new Replacement());
    }
});


module.exports = Deobfuscate;


// ==============================================
// Def deobfuscate function on node
// ==============================================
function DEFDEOB(node, fun) {
    node.DEFMETHOD('deobfuscate', fun);
};

DEFDEOB(AST_Label, function(w) {
});

DEFDEOB(AST_Scope, function(w) {
    var self = this, reverse_manglings = w.options['reverse_manglings'];
    // this.enclosed: contains definitions that declared in or out the scope, and used in this scope; but not including these defined in the sub scopes of the scope
    // this.variables: contains definitions that declared and used only in the scope; not includes the ones defined out of the scope

    this.variables.each(function(def){
        if(def.orig.length > 1) {
            // currently, is not save to reverse mangled the varDef defined in more than one places
            // because currently it's very hard to specify the scope in the config file, user has to manually said that definitions in which scope should be reverse-mangled
            // the if condition should be reverse_manglings.hasOwnProperty(def.name) && <this is the scope that user want to appy> 
            if(reverse_manglings.hasOwnProperty(def.name)) {
                throw new Error("the decleration should not be used anywhere else for a minified code");
            }
        }else {
            // if this variable require reverse mangling, do it
            if(reverse_manglings.hasOwnProperty(def.name) && !def.mangled_name) {
                def.mangled_name = reverse_manglings[def.name];
            }
        }
    });

    // symbol inline!!
    var defOutside = [];
    this.enclosed.forEach(function(def) {
        defOutside.push(def);
    });
    this.variables.each(function(def) {
        var idx = defOutside.indexOf(def);
        if(idx !== -1) 
            defOutside.splice(idx, 1);
    });

    defOutside.forEach(function(def) {
        if(def.orig.length > 1) {
            // currently it's not safe to handle this situation
        }else {
            def.outside = true;
        }
    });
});



DEFDEOB(AST_LabeledStatement, function(w) {
    throw new Error("AST_LabeledStatement is not handling yet");
});


DEFDEOB(AST_ObjectKeyVal, function(w) {
    var key = this.key, value = this.value;
    if(w.options['arggressive']) {
        if(value instanceof AST_SymbolRef) {
            // if key is not an identifier
            if(!is_identifier_string(key) || value.hasOwnProperty(replacename)) {
                return;
            }

            // give meaningfull name
            var ext = value.thedef.scope.enclosed, dup = false;
            for (var i = ext.length; --i >= 0;) {
                var sym = ext[i];
                var name = sym.mangled_name || sym.name;
                if (key == name)  {
                    dup = true;
                    break;
                }
            }

            if(!dup)
                value.thedef.mangled_name = key;
        }
    }
});

DEFDEOB(AST_PropAccess, function(w) {
    // translate for PropAcess, 
});

DEFDEOB(AST_Sub, function(w) {
    AST_PropAccess.prototype.deobfuscate.call(this,w);
    var self = this, exp = self.expression, prop = self.property;
    if(prop instanceof AST_String) {
        if(is_identifier_string(prop.value)) {
            self[replacename] = make_node(AST_Dot, self, {
                expression: exp.hasOwnProperty(replacename) ? exp[replacename] : exp,
                property: prop.value
            });
        }
    }else if(exp instanceof AST_SymbolRef || exp instanceof AST_PropAccess || exp instanceof AST_Node) {
        var def = exp.thedef;
        if(prop instanceof AST_SymbolRef) {
            if(prop.hasOwnProperty(replacename) && prop[replacename] instanceof AST_String) {
                self[replacename] = make_node(AST_Dot, self, {
                    expression: exp.hasOwnProperty(replacename) ? exp[replacename] : exp,
                    property: prop[replacename].value
                });
            }
        }
    }
});



DEFDEOB(AST_Dot, function(w) {
    AST_PropAccess.prototype.deobfuscate.call(this,w);
    var self = this, exp = self.expression, prop = self.property, prop_replaces = w.options['prop_replaces'], str = this.print_to_string();
    // replace the property name
    if(prop_replaces.hasOwnProperty(str)) {
        if(exp instanceof AST_Dot) {
            AST_Dot.prototype.deobfuscate.call(exp,w);
        }
        self[replacename] = make_node(AST_Dot, self, {
            expression:exp.hasOwnProperty(replacename) ? exp[replacename] : exp,
            property: prop_replaces[str]
        });
    }
});


DEFDEOB(AST_Lambda, function(w) {
    AST_Scope.prototype.deobfuscate.call(this,w);
});

DEFDEOB(AST_Defun, function(w) {
    AST_Lambda.prototype.deobfuscate.call(this,w);
    var self = this, name = this.name;
});

DEFDEOB(AST_SymbolDefun, function(w) {
    var self = this, name = this.name, def = this.thedef, reverse_manglings = w.options['reverse_manglings'];
    if(def.orig.length > 1) 
        return; // escape the definations that define in multiple places

    if(reverse_manglings.hasOwnProperty(def.name) && !def.mangled_name) {
        def.mangled_name = reverse_manglings[def.name];
    }
});


DEFDEOB(AST_SymbolAccessor, function(w) {
});


DEFDEOB(AST_SymbolFunarg, function(w) {
});



DEFDEOB(AST_SimpleStatement, function(w) {
});

DEFDEOB(AST_Call, function(w) {
    var self = this, exp = this.expression, args = this.args;
    if(exp instanceof AST_SymbolRef) {
        // try inline?
    }
});



DEFDEOB(AST_VarDef, function(w) {
    var name = this.name, value = this.value, constants = w.options['constants'];
    var prefix = "$d_";
    if(name.thedef.orig.length > 1) {
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
        }else if (value instanceof AST_SymbolRef && (value.thedef.outside || value.thedef.undeclared)){ // replace all the reassignments for global variables
            // in a single merged js, any undeclared variables are either builtin variables like 'window', etc. or global variables that imported from another js file
            name.thedef.mangled_name = prefix+value_str;
            name.thedef.references.forEach(function(ref) {
                ref[replacename] = value.hasOwnProperty(replacename) ? value[replacename].clone() : value.clone();
            });
        }else if (w.options['nogetset'] && !name.thedef.outside && value instanceof AST_PropAccess) {
            // Important! if there are syntax that enable 'get'/'set' in javascript, the PropAcess will have side effect; so once you have 'get'/'set' in code, it's very dangous to make it as inline
            name.thedef.mangled_name = prefix+name.thedef.name;
            name.thedef.references.forEach(function(ref) {
                ref[replacename] = value.hasOwnProperty(replacename) ? value[replacename].clone() : value.clone();
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
});



// ==============================================
// Change the Default Output
// ==============================================
function DEFPRINT(nodetype, generator) {
    nodetype.DEFMETHOD("_codegen", generator);
};

function changeDefaultOutputs() {
    DEFPRINT(AST_Undefined, function(self, output){
        output.print("undefined");
    });
};
