DeObfuscate Js
============================

This project is targeting to make minified code more readable and more structured. It utilized the uglifyJs AST.



What this project will do:

   1. Translate Constants: usually, compressor will use variables with short id to replace global objects and constants like: 'window', 'Object', 'undefined', 'null', etc. deobfuscateJs will translate these back.
   2. String Property Access: to save file size, common property accesses(```a.hasOwnProperty('xxx')```) usually will to transform to ```var b="hasOwnProperty"; a[b]('xxx')```, deobfuscateJs try to resolve this and also avoid side effect.
   3. Inline Functions: For simple functions that compressor used to compress the statement into function calls, if the function is speficed in "inline_functions" in 'config.json', these functions will be inlined. or if you try aggressive mode, then all the functions that could be inlined (simple, only has one statement, the call statement has no side effect for the arguments)
   4. Reverse Mangling: =debo= will try to mangle all the pairs in "reverse_manglings" for 'config.json', so if you find out the really name, just put a entry like ``` "xb":"getLength"``` in the entry.


Install
-------------
``` javascript
   npm install deobfuscate
```


How To
-------------
``` javascript
    deob -h
```
The help information will display:
```  
Usage: deob [options]

Options:

-h, --help                  output usage information
-V, --version               output the version number
-s, --silent                Don't output anything
-o, --output [file]         File that deobfuscated js will be stored to
-c, --config [config.json]  Customize config files for deobfuscating
-t,--trace                  Enable function instruments tracing
--pipe                      Enable pipe output
--inline                    Try to inline simple functions, it's unsafe
--nogetset                  Assume that there is no getter/setter in code
```



TODOs
------------------
* Change to SpiderMonkey AST Tree
* Bi-direction AST Tree
* More deep constants value detecting. 
    * Invariability spread from global undeclared variables into variables in small scopes
    * More intelligent name guessing based on key-value pairs
* Enhance the AST Tree to enable duplicated definitions analysis

* Add other new optimization that compressor will use
* Inline for functions with multiple statements (may no needs)
