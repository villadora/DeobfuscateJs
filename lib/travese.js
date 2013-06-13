/**
 * define travelable properties in AST_*
 * @param {function} AST_* node types
 * @param {Array.<string>} names of properties that could be traveled
 */
var c = 0;

function _defTravel(nodetype, props) {
    nodetype.prototype._travelable = props;
    /**
     * function to travel the node in pre-order sequence
     * @param {function(this:AST_Node, string, AST_Node|Array)}
     */
    nodetype.prototype.travel = function(before, after) {
        for(var l = this._travelable.length; l-- > 0;) {
            var prop = this._travelable[l];
            if((prop in this) && this[prop]) {
                if(before) before.call(this, prop, this[prop]);
                if(this[prop].forEach && this[prop].concat && typeof this[prop].length == 'number') {
                    var ary = this[prop];
                    ary.forEach(function(item, idx){
                        if(!item.__traveling__) {
                            if(before) before.call(ary, idx, item);
                            if(item.travel instanceof Function)
                                item.travel(before, after);
                            
                            if(after) after.call(ary,idx,item);
                        }
                    });
                }else if(this[prop].travel instanceof Function){
                    this[prop].travel(before, after);
                }

                if(after) after.call(this, prop, this[prop]);
            }
        }
    };
}

_defTravel(AST_Node, []);
_defTravel(AST_LabeledStatement, ["label","body"]);
_defTravel(AST_SimpleStatement, ["body"]);
_defTravel(AST_Block,["body"]);
_defTravel(AST_DWLoop, ["condition","body"]);
_defTravel(AST_For, ["init", "condition", "step", "body"]);
_defTravel(AST_ForIn, ["init","object","body"]);
_defTravel(AST_With, ["expression", "body"]);
_defTravel(AST_Exit, ["value"]);
_defTravel(AST_LoopControl, ["label"]);
_defTravel(AST_If, ["condition", "body", "alternative"]);
_defTravel(AST_Switch, ["expression", "body"]);
_defTravel(AST_Case, ["expression", "body"]);
_defTravel(AST_Try, ["body", "bcatch", "bfinally"]);
_defTravel(AST_Catch, ["argname", "body"]);
_defTravel(AST_Definitions, ["definitions"]);
_defTravel(AST_VarDef, ["value"]);
_defTravel(AST_Lambda, ["name", "argnames", "body"]);
_defTravel(AST_Call, ["expression", "args"]);
_defTravel(AST_Seq, ["car", "cdr"]);
_defTravel(AST_Dot, ["expression"]);
_defTravel(AST_Sub, ["expression", "property"]);
_defTravel(AST_Unary, ["expression"]);
_defTravel(AST_Binary, ["left", "right"]);
_defTravel(AST_Conditional, ["condition", "consequent", "alternative"]);
_defTravel(AST_Array, ["elements"]);
_defTravel(AST_Object,["properties"]);
_defTravel(AST_ObjectProperty,["value"]);

AST_Node.prototype.deepClone = function() {
    var newObj = new this.CTOR(this);
    newObj.travel(function(prop, elm) {
        if(elm.forEach && elm.concat && typeof elm.length == 'number') {
            this[prop] = elm.concat();
        }else if('clone' in this[prop]) {
            this[prop] = elm.clone();
            // what's the hell, that elm.clone() only clone predefine properties
            for(var k in elm) {
                this[prop][k] = elm[k];
            }
        }
    });
    return newObj;
};
