#!/usr/bin/env node

var U2 = require('uglify-js'),
program = require("commander"),
fs = require('fs'),
exists = fs.existsSync,
path = require('path'),
dirname = path.dirname,
basename = path.basename,
extname = path.extname,
join = path.join,
Deob = require('./deobfuscate'),
mkdirp = require('mkdirp'),
InlineFunction = require('./inline'),
Tracer = require('./tracer'),
ConstantReplaces = require('./constants'),
ReverseManglings = require('./reverses')
;


// load config
var PACKAGE_CONFIG = require('../package');

var DEFAULT_CONFIG = require('./config');
DEFAULT_CONFIG["constants"]["void 0"] = undefined;
DEFAULT_CONFIG["constants"]["Infinity"] = Infinity;


// ==============================================
// Change the Default Output
// ==============================================
U2.AST_Undefined.DEFMETHOD('_codegen', function(self, output) {
    output.print("undefined");
});



/** ======================================
 *  Program Start
 * ======================================= */
program.version(PACKAGE_CONFIG.version).
    option("-s, --silent", "Don't output anything").
    option("-w, --watch", "Watch the config file and deob the target once the config file changed").
    option("-o, --output [file]", "File that deobfuscated js will be stored to").
    option("-c, --config [config.json]", "Customize config files for deobfuscating, will try to read [filename].debo.json by default").
    option("-t,--trace", "Enable function instruments tracing").
    option("--pipe", "Enable pipe output").
    option("--inline", "Try to inline simple functions in config").
    option("-a, --aggressive", "Try to inline all the simple functions and use , it's unsafe").
    option("--nogetset", "Assume that there is no getter/setter in code").
    parse(process.argv);


if(!program.args.length) {
    console.log("Please provide a input file");
}


var inputFile = program.args[0];


var config_file_name = program.config || join(process.cwd(), dirname(inputFile), basename(inputFile, extname(inputFile))+".deob.json");
if(fs.existsSync(config_file_name)) {
    if(program.watch) {
        fs.readFile(config_file_name, 'utf-8', function(err, json) {
            if(err) throw err;
            run(JSON.parse(json));
        });
        
        fs.watchFile(config_file_name, function (curr, prev) {
            console.log("'%s' changed, redo deob", config_file_name);
            try {
                fs.readFile(config_file_name, 'utf-8', function(err, json) {
                    if(err) 
                        console.log(err);
                    else
                        run(JSON.parse(json));
                });
            }catch(e) {
                console.error(err);
            }
        });
    }else  {
        fs.readFile(config_file_name, 'utf-8', function(err, json) {
            if(err)
                throw err;
            run(JSON.parse(json));
        });
    }
}else 
    run();


function run(deob_cfg) {
    deob_cfg = defaults(deob_cfg, DEFAULT_CONFIG);
    fs.readFile(inputFile,'utf-8', function(err, content) {
        if(err)
            throw err;
        
        var topLevel, ast = U2.parse(content, {
            filename: inputFile,
            topLevel: topLevel
        });


        deob_cfg.verbose = program.pipe || !program.silent;
        deob_cfg.trace = program.trace || false;
        deob_cfg.nogetset = program.nogetset || false;
        deob_cfg.inline = program.inline || false;
        deob_cfg.aggressive = program.aggressive || false;

        ast.figure_out_scope();

        if(program.inline) {
            ast = ast.transform(new InlineFunction({'aggressive':program.aggressive,'fnames': deob_cfg['inline_functions']}));
            // recalculate the symbol-define link
            ast.figure_out_scope();
        }

        ast = ast.transform(new ConstantReplaces(deob_cfg));

        ast = ast.transform(new Deob(deob_cfg));
        // recalculate the symbol-define link, but! this will recreate all the SymbolDef:-(
        // ast.figure_out_scope();

        var tracing_inject = "";
        if(program.trace) {
            tracing_inject = fs.readFileSync(join(__dirname,"trace.inject.js"))+"\n";
            ast = ast.transform(new Tracer());
        }


        // reverse_manglings is the last step
        ast = ast.transform(new ReverseManglings(deob_cfg));
        if(program.output) {
            var baseDir = dirname(program.output);
            mkdirp(baseDir, function(err) {
                if(err) console.error(err);
                fs.writeFile(program.output, tracing_inject+ast.print_to_string({comments:true, beautify:true}), function(err) {if(err) throw err;});
            });
        } else if(program.silent)
            return;
        else if(program.pipe)
            process.stdout.write(tracing_inject+ast.print_to_string({beautify:true, comments:true}));
    });
};



function defaults(args, defs) {
    args = args || {};
    var ret = args || {};
    for (var i in defs) 
        if (defs.hasOwnProperty(i)) {
            ret[i] = (args && args.hasOwnProperty(i)) ? args[i] : defs[i];
        }
    return ret;
};
