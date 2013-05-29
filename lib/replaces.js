"use strict"

var U2 = require('uglify-js');

function Replacement(options){
    if(!(this instanceof Replacement))
        return new Replacement();
    
    U2.TreeTransformer.call(this, this.before, this.after);
}

Replacement.replacename = '_replaced';


Replacement.prototype = new U2.TreeTransformer;

module.exports = Replacement;

Replacement.prototype.before = function(node, descend) {
    if(node.hasOwnProperty(Replacement.replacename)) {
        var rep =  node[Replacement.replacename];
        delete node[Replacement.replacename];
        return rep;
    }
    descend(node, this);
    return node;
};
