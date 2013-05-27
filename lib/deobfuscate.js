"use strict"

var U2 = require('uglify-js'),
TreeTransformer = U2.TreeTransformer,
TreeWalker = U2.TreeWalker,
DEFAULT_CONFIG = require('./config')
;

// Handle that json file can not have undefined as value
DEFAULT_CONFIG["constants"]["void 0"] = undefined;
DEFAULT_CONFIG["constants"]["Infinity"] = Infinity;

// import all AST_* structures
(function() {
    for (var key in U2) {
        if(/^AST_/.test(key))
            global[key] = U2[key];
    }
})();

/** @const **/ var VERBOSE = DEFAULT_CONFIG["verbose"];

/** @const **/ var TRACE_SYM_REF = make_node(AST_SymbolRef, null, {
    name:'TRACE',
    start:'',
    end:''
});

// Deobfuscate class
function Deobfuscate(options, false_by_default) {
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
        if(this.option('trace')) {
            // define TRACE object in global
            topLevel.def_variable(TRACE_SYM_REF);
        }

        var tw = new TreeWalker(function(node) {
            if(node.deobfuscate) {
                node.deobfuscate(tw);
            }
        });

        tw.options = this.options;

        // walk the ast tree
        topLevel.walk(tw);
        
        // try replacement for the ast
        var tt = new TreeTransformer(function(node, descend) {
            if(node._deob) return node; // if the ndoe is already deobed

            if(node.hasOwnProperty('_replaced'))
                return node['_replaced'];

            descend(node, this);
            node._deob = true;
            return node;
        });

        return topLevel.transform(tt);;
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
    //    console.log(this.enclosed.length, this.variables.size(), this.enclosed.length == this.variables.size());
    var reverse_manglings = w.options['reverse_manglings'], guesses = w.options['guesses'];
    // this.enclosed：定义了在这个scope中或者外部申明同时在这个scope中被使用到的变量定义, 不包含在子scope中定义并使用的变量
    // this.variables: 定义了在这个scope中直接定义的变量, 不包含在外部定义的变量
    this.enclosed.forEach(function(def) {
    });

    this.variables.each(function(def){
        // symbol is SymbolDef
        // node.enclosed: 在这个scope中用到的symbolDef
        if(def.orig.length > 1) {
            // currently, is not save to reverse mangled the varDef defined in more than one places
            if(reverse_manglings.hasOwnProperty(def.name) || guesses.indexOf(def.name) !== -1) {
                if(VERBOSE) console.warn("There are reused varible definitions!!!");
                throw new Error("the decleration should not be used anywhere else for a minified code");
            }
        }else {
            // if this variable require reverse mangling, do it
            if(reverse_manglings.hasOwnProperty(def.name) && !def.mangled_name) {
                 def.mangled_name = reverse_manglings[def.name];
            }else if(guesses.indexOf(def.name) != -1) {
                console.info("This variable %s shows up",def.name);
            }
        }
    });


    // trace for AST_Lambda
    if(this instanceof AST_Lambda) {
        var body = this.body;
        if(body && w.options['trace']) {
            body.unshift(make_node(AST_SimpleStatement, null, {
                body: make_node(AST_Call, null, {
                    expression: TRACE_SYM_REF.clone(),
                    args:[
                        make_node_from_constant(this.name),
                        make_node_from_constant(this.start.line.toString())
                    ]
                }),
                start: '',
                end:''
            }));
        }
    }

});


DEFDEOB(AST_SymbolDeclaration, function(w) {
    // this is function defination
    var def = this.thedef;
    //def.mangled_name 
});


DEFDEOB(AST_LabeledStatement, function(w) {
    throw new Error("AST_LabeledStatement is not handling yet");
});


DEFDEOB(AST_ObjectKeyVal, function(w) {
    //    console.error(this.print_to_string());
    var key = this.key, value = this.value;
    if(value instanceof AST_SymbolRef) {
        value.thedef.mangled_name = key;
    }
});

DEFDEOB(AST_PropAccess, function(w) {
    
});

DEFDEOB(AST_Sub, function(w) {
    var self = this, exp = self.expression, prop = self.property;
    if(exp instanceof AST_SymbolRef) {
        var def = exp.thedef;
        if(prop instanceof AST_SymbolRef) {
            if(prop.hasOwnProperty('_replaced') && prop['_replaced'] instanceof AST_String) {
                self['_replaced'] = make_node(AST_Dot, self, {
                    expression: exp.hasOwnProperty('_replaced') ? exp['_replaced'] : exp,
                    property: prop['_replaced'].value
                });
            }
        }
        //        console.log(this.expression.name, def, def.value);
    }
});

DEFDEOB(AST_SymbolAccessor, function(w) {
});


DEFDEOB(AST_SymbolFunarg, function(w) {
    
});

DEFDEOB(AST_SimpleStatement, function(w) {
    // Visit AST_Call here
    if(this.body instanceof AST_Call) {

    }
});

DEFDEOB(AST_Call, function(w) {
    // never get visited because of uglifyjs walker implementation
});


DEFDEOB(AST_VarDef, function(w) {
    var name = this.name, value = this.value, constants = w.options['constants'];
    var prefix = "$d_";
    if(value) {
        var value_str = value.print_to_string();
        if(constants.hasOwnProperty(value_str)) {
            // 1. empty declaration is not nessecary
            name.thedef.mangled_name = prefix+constants[value_str];

            if(name.thedef.orig.length > 1) {
                name.thedef.orig.forEach(function(decl) {
                    // decl is SymbolVar, the same as name
                    // decl's parent is VarDef should be emptyStatement
                    // console.log(decl.TYPE, decl == name, varDef.TYPE);
                });
                throw new Error("the decleration should not be used anywhere else for a minified code");
            }
            
            // 2. Replace references
            name.thedef.references.forEach(function(ref){
                // ref is SymbolRef
                ref['_replaced'] = make_node_from_constant(constants[value_str], ref);
            });
        }else if (value instanceof AST_SymbolRef && value.thedef.undeclared){ // replace all the reassignments
            // in a single merged js, any undeclared variables are either builtin variables like 'window', etc. or global variables that imported from another js file
            name.thedef.mangled_name = prefix+value_str;
            name.thedef.references.forEach(function(ref) {
                ref['_replaced'] = value.clone();
            });
        }else if(value instanceof AST_SimpleStatement){
        }else if(value instanceof AST_String) {
            name.thedef.mangled_name = prefix + name.thedef.name;
            name.thedef.references.forEach(function(ref) {
                ref['_replaced'] = make_node_from_constant(value.value);
            });
        }else {
        }
    }
});


// ==============================================
// Helper Functions
// ==============================================
function make_node(ctor, orig, props) {
    if (!props) props = {};
    if (orig) {
        if (!props.start) props.start = orig.start;
        if (!props.end) props.end = orig.end;
    }
    return new ctor(props);
};


function make_node_from_constant(val, orig) {
    if (val instanceof AST_Node) return val;
    switch (typeof val) {
    case "string":
        return make_node(AST_String, orig, {
            value: val
        });
    case "number":
        return make_node(isNaN(val) ? AST_NaN : AST_Number, orig, {
            value: val
        });
    case "boolean":
        return make_node(val ? AST_True : AST_False, orig);
    case "undefined":
        return make_node(AST_Undefined, orig);
    default:
        if (val === null) {
            return make_node(AST_Null, orig);
        }
        if (val instanceof RegExp) {
            return make_node(AST_RegExp, orig);
        }
        throw new Error(string_template("Can't handle constant of type: {type}", {
            type: typeof val
        }));
    }
};


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


// ==============================================
// Utilities  in UglifyJs/lib/util.js
// ==============================================
function array_to_hash(a) {
    var ret = Object.create(null);
    for (var i = 0; i < a.length; ++i)
        ret[a[i]] = true;
    return ret;
};

function slice(a, start) {
    return Array.prototype.slice.call(a, start || 0);
};

function characters(str) {
    return str.split("");
};

function member(name, array) {
    for (var i = array.length; --i >= 0;)
        if (array[i] == name)
            return true;
    return false;
};

function find_if(func, array) {
    for (var i = 0, n = array.length; i < n; ++i) {
        if (func(array[i]))
            return array[i];
    }
};

function repeat_string(str, i) {
    if (i <= 0) return "";
    if (i == 1) return str;
    var d = repeat_string(str, i >> 1);
    d += d;
    if (i & 1) d += str;
    return d;
};

function DefaultsError(msg, defs) {
    this.msg = msg;
    this.defs = defs;
};

function defaults(args, defs, croak) {
    if (args === true)
        args = {};
    var ret = args || {};
    if (croak) 
        for (var i in ret) if (ret.hasOwnProperty(i) && !defs.hasOwnProperty(i))
            throw new DefaultsError("`" + i + "` is not a supported option", defs);
    for (var i in defs) if (defs.hasOwnProperty(i)) {
        ret[i] = (args && args.hasOwnProperty(i)) ? args[i] : defs[i];
    }
    return ret;
};

function merge(obj, ext) {
    for (var i in ext) if (ext.hasOwnProperty(i)) {
        obj[i] = ext[i];
    }
    return obj;
};

function noop() {};

var MAP = (function(){
    function MAP(a, f, backwards) {
        var ret = [], top = [], i;
        function doit() {
            var val = f(a[i], i);
            var is_last = val instanceof Last;
            if (is_last) val = val.v;
            if (val instanceof AtTop) {
                val = val.v;
                if (val instanceof Splice) {
                    top.push.apply(top, backwards ? val.v.slice().reverse() : val.v);
                } else {
                    top.push(val);
                }
            }
            else if (val !== skip) {
                if (val instanceof Splice) {
                    ret.push.apply(ret, backwards ? val.v.slice().reverse() : val.v);
                } else {
                    ret.push(val);
                }
            }
            return is_last;
        };
        if (a instanceof Array) {
            if (backwards) {
                for (i = a.length; --i >= 0;) if (doit()) break;
                ret.reverse();
                top.reverse();
            } else {
                for (i = 0; i < a.length; ++i) if (doit()) break;
            }
        }
        else {
            for (i in a) if (a.hasOwnProperty(i)) if (doit()) break;
        }
        return top.concat(ret);
    };
    MAP.at_top = function(val) { return new AtTop(val) };
    MAP.splice = function(val) { return new Splice(val) };
    MAP.last = function(val) { return new Last(val) };
    var skip = MAP.skip = {};
    function AtTop(val) { this.v = val };
    function Splice(val) { this.v = val };
    function Last(val) { this.v = val };
    return MAP;
})();

function push_uniq(array, el) {
    if (array.indexOf(el) < 0)
        array.push(el);
};

function string_template(text, props) {
    return text.replace(/\{(.+?)\}/g, function(str, p){
        return props[p];
    });
};

function remove(array, el) {
    for (var i = array.length; --i >= 0;) {
        if (array[i] === el) array.splice(i, 1);
    }
};

function mergeSort(array, cmp) {
    if (array.length < 2) return array.slice();
    function merge(a, b) {
        var r = [], ai = 0, bi = 0, i = 0;
        while (ai < a.length && bi < b.length) {
            cmp(a[ai], b[bi]) <= 0
                ? r[i++] = a[ai++]
                : r[i++] = b[bi++];
        }
        if (ai < a.length) r.push.apply(r, a.slice(ai));
        if (bi < b.length) r.push.apply(r, b.slice(bi));
        return r;
    };
    function _ms(a) {
        if (a.length <= 1)
            return a;
        var m = Math.floor(a.length / 2), left = a.slice(0, m), right = a.slice(m);
        left = _ms(left);
        right = _ms(right);
        return merge(left, right);
    };
    return _ms(array);
};

function set_difference(a, b) {
    return a.filter(function(el){
        return b.indexOf(el) < 0;
    });
};

function set_intersection(a, b) {
    return a.filter(function(el){
        return b.indexOf(el) >= 0;
    });
};

// this function is taken from Acorn [1], written by Marijn Haverbeke
// [1] https://github.com/marijnh/acorn
function makePredicate(words) {
    if (!(words instanceof Array)) words = words.split(" ");
    var f = "", cats = [];
    out: for (var i = 0; i < words.length; ++i) {
        for (var j = 0; j < cats.length; ++j)
            if (cats[j][0].length == words[i].length) {
                cats[j].push(words[i]);
                continue out;
            }
        cats.push([words[i]]);
    }
    function compareTo(arr) {
        if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
        f += "switch(str){";
        for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":";
        f += "return true}return false;";
    }
    // When there are more than three length categories, an outer
    // switch first dispatches on the lengths, to save on comparisons.
    if (cats.length > 3) {
        cats.sort(function(a, b) {return b.length - a.length;});
        f += "switch(str.length){";
        for (var i = 0; i < cats.length; ++i) {
            var cat = cats[i];
            f += "case " + cat[0].length + ":";
            compareTo(cat);
        }
        f += "}";
        // Otherwise, simply generate a flat `switch` statement.
    } else {
        compareTo(words);
    }
    return new Function("str", f);
};

function all(array, predicate) {
    for (var i = array.length; --i >= 0;)
        if (!predicate(array[i]))
            return false;
    return true;
};

function Dictionary() {
    this._values = Object.create(null);
    this._size = 0;
};
Dictionary.prototype = {
    set: function(key, val) {
        if (!this.has(key)) ++this._size;
        this._values["$" + key] = val;
        return this;
    },
    add: function(key, val) {
        if (this.has(key)) {
            this.get(key).push(val);
        } else {
            this.set(key, [ val ]);
        }
        return this;
    },
    get: function(key) { return this._values["$" + key] },
    del: function(key) {
        if (this.has(key)) {
            --this._size;
            delete this._values["$" + key];
        }
        return this;
    },
    has: function(key) { return ("$" + key) in this._values },
    each: function(f) {
        for (var i in this._values)
            f(this._values[i], i.substr(1));
    },
    size: function() {
        return this._size;
    },
    map: function(f) {
        var ret = [];
        for (var i in this._values)
            ret.push(f(this._values[i], i.substr(1)));
        return ret;
    }
};
