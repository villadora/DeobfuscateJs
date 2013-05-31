"use strict"

var U2 = require('uglify-js'),
vm = require('vm'),
path = require('path'),
fs = require('fs')
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
function ReverseManglings(options) {
    if(!(this instanceof ReverseManglings))
        return new ReverseManglings(options);

    this.options = defaults(options, {});
    TreeTransformer.call(this, this.before, this.after);
}

module.exports = ReverseManglings;

ReverseManglings.prototype = new TreeTransformer;


merge(ReverseManglings.prototype,  {
    option: function(key) { return this.options[key] },
    before: function(topLevel) {
        var aggressive = this.option('aggressive'), reverse_manglings = this.option('reverse_manglings');
        var tw = new TreeWalker(function(node){
            if(node instanceof AST_SymbolDefun) {
                var name = node.name, def = node.thedef;
                if(def.orig.length > 1) 
                    return; // escape the definations that define in multiple places
                
                if(reverse_manglings.hasOwnProperty(def.name) && !def.mangled_name) {
                    def.mangled_name = reverse_manglings[def.name];
                }
            }else if (node instanceof AST_Scope) {
                // node.enclosed: contains definitions that declared in or out the scope, and used in this scope; but not including these defined in the sub scopes of the scope
                // node.variables: contains definitions that declared and used only in the scope; not includes the ones defined out of the scope

                node.variables.each(function(def){
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
                
            }
        });

        topLevel.walk(tw);
        return topLevel;
    }
});
