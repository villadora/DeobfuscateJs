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



// Deobfuscate class
function Deobfuscate(options) {
    if(!(this instanceof Deobfuscate))
        return new Deobfuscate(options);

    this.options = defaults(options, {});
    
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
});



DEFDEOB(AST_LabeledStatement, function(w) {
    //    throw new Error("AST_LabeledStatement is not handling yet");
});



DEFDEOB(AST_ObjectKeyVal, function(w) {
    var key = this.key, value = this.value;
    if(w.options['aggressive']) {
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

});
DEFDEOB(AST_Binary, function(w) {

});


DEFDEOB(AST_Assign, function(w) {
    if('deobfuscate' in AST_Binary.prototype) AST_Binary.prototype.deobfuscate.call(this, w);
    var left = this.left, right = this.right;

    if(w.options['aggressive']) {
        if(left instanceof AST_Dot && right instanceof AST_SymbolRef) {
            var prop = left.property;
            // if key is not an identifier
            if(!is_identifier_string(prop) || right.hasOwnProperty(replacename)) {
                return;
            }

            // give meaningfull name
            var ext = right.thedef.scope.enclosed, dup = false;
            for (var i = ext.length; --i >= 0;) {
                var sym = ext[i];
                var name = sym.mangled_name || sym.name;
                if (prop == name)  {
                    dup = true;
                    break;
                }
            }

            if(!dup)
                right.thedef.mangled_name = prop;
        }
    }
});
