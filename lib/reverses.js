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
function ReverseManglings(options) {
    if(!(this instanceof ReverseManglings))
        return new ReverseManglings(options);

    this.options = defaults(options, {});
    TreeTransformer.call(this, this.before, this.after);
}

module.exports = ReverseManglings;

ReverseManglings.prototype = new TreeTransformer;

//find prototype

function findProto(node) {
    if(node instanceof AST_Assign) {
        if(node.right instanceof AST_New) {
            // as for all the AST_Dot, the property is string, it's easily to find out the property and replace it with meanfull strings; but for AST_Sub, it's very hard to determind what is value for the properties if the property is a symbol or variables
//            console.log(node.print_to_string());
        }
    }
};


function replaceDOT(node, dict) {
//    if(node.print_to_string().indexOf('prototype') != -1) console.log(node.print_to_string());
    if(dict.hasOwnProperty(node.print_to_string())) {
        if(node.expression instanceof AST_Dot)
            replaceDOT.apply(null, node.expression, dict);

        node[replacename] = make_node(AST_Dot, node, {
            expression:node.expression.hasOwnProperty(replacename) ? node.expression[replacename] : node.expression,
            property: dict[node.print_to_string()]
        });
    }
}

merge(ReverseManglings.prototype,  {
    option: function(key) { return this.options[key] },
    before: function(topLevel) {
        var aggressive = this.option('aggressive'), reverse_manglings = {}, propAccess = {};
        var manglings =  this.option('reverse_manglings');
        for(var k in manglings) {
            if(k.indexOf('.') != -1) {
                propAccess[k] =  manglings[k];
            }else {
                reverse_manglings[k] = manglings[k];
            }
        }
        var tw = new TreeWalker(function(node){
            findProto(node);
            if(node instanceof AST_Dot) {
                replaceDOT(node, propAccess);
            }else if(node instanceof AST_SymbolDefun) {
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
                            console.error("name:%s, line:%s, col:%s", def.name, node.start.line, node.start.col);
                            throw new Error("the decleration should not be used anywhere else for a minified code", def.name);
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
        return topLevel.transform(new Replacement());
    }
});
