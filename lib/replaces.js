"use strict"

var U2 = require('uglify-js');

function Replacement(options){
    if(!(this instanceof Replacement))
        return new Replacement();
    
    U2.TreeTransformer.call(this, this.before, this.after);
}

var replacename = Replacement.replacename = '_replaced';


Replacement.prototype = new U2.TreeTransformer;

module.exports = Replacement;

Replacement.prototype.before = function(node, descend) {
    if(node.hasOwnProperty(replacename)) {
        var rep =  node[replacename];
        rep.start = node.start, rep.end = node.end;
        delete node[replacename];
        return rep.transform(this);
    }
    descend(node, this);
    return node;
};
