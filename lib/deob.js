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
InlineFunction = require('./inline'),
Tracer = require('./tracer')
;


var PACKAGE_CONFIG = require('../package');

program.version(PACKAGE_CONFIG.version).
    option("-s, --silent", "Don't output anything").
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


if(program.config) {
    fs.readFile(program.config, 'utf-8',function(err, json) {
        if(err)
            throw err;
        run(JSON.parse(json));
    });
}else {
    var config_file_name = join(process.cwd(), dirname(inputFile), basename(inputFile, extname(inputFile))+".deob.json");
    if(fs.existsSync(config_file_name)) {
        fs.readFile(config_file_name, 'utf-8', function(err, json) {
            if(err)
                throw err;
            run(JSON.parse(json));
        });
    }else 
        run();
}

function run(deob_cfg) {
    deob_cfg = deob_cfg || {};
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
        }


        ast = ast.transform(new Deob(deob_cfg));

        var tracing_inject = "";
        if(program.trace) {
            tracing_inject = fs.readFileSync(join(__dirname,"trace.inject.js"))+"\n";
            ast = ast.transform(new Tracer());
        }


        if(program.output)
            fs.writeFile(program.output, tracing_inject+ast.print_to_string({beautify:true}), function(err) {if(err) throw err;});
        else if(program.silent)
            return;
        else if(program.pipe)
            process.stdout.write(tracing_inject+ast.print_to_string({beautify:true, comments:true}));
    });
};
