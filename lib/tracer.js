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


/** @const **/ var TRACE_SYM_REF = make_node(AST_SymbolRef, null, {
    name:'TRACE',
    start:'',
    end:''
});

// InlineFunction class
function Tracer(options) {
    if(!(this instanceof Tracer))
        return new Tracer(options);

    this.options = defaults(options, {
    });
    
    TreeTransformer.call(this, this.before, this.after);
}

Tracer.prototype = new TreeTransformer;

module.exports = Tracer;

merge(Tracer.prototype,  {
    option: function(key) { return this.options[key] },
    before: function(topLevel) {
        // define TRACE object in global
        topLevel.def_variable(TRACE_SYM_REF);

        var tw = new TreeWalker(function(node, descend) {
            if(node instanceof AST_Lambda) {
                var body = node.body;
                if(body) {
                    body.unshift(make_node(AST_SimpleStatement, null, {
                        body: make_node(AST_Call, null, {
                            expression: TRACE_SYM_REF.clone(),
                            args:[
                                make_node_from_constant(node.name.name),
                                make_node_from_constant(node.start.line.toString())
                            ]
                        }),
                        start: node.start,
                        end: node.end
                    }));
                }
            };
        });

        topLevel.walk(tw);

        return topLevel;
    }
});        


