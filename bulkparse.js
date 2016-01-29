var fs = require("fs");
var dom = require("xmldom")
var domparser = dom.DOMParser;
var xpath = require("xpath");

function loadFiles (dir, files_){
    files_ = files_ || [];
    var files = fs.readdirSync(dir);
    for (var i in files){
        var name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()){
            getFiles(name, files_);
        } else {
            files_.push(name);
        }
    }
    return files_;
}

var xmiLibrary = require("./lib/xmiLibrary");

// Input
var datafile = loadFiles("data");
// var datafile = "data/model2.xmi";
// var datafile = "data/model.xml";

for (var i in datafile){
	var contents = fs.readFileSync(datafile[i]).toString();
	var xmi = new xmiLibrary.XMI();
	var sequenceDiagram = xmi.parse(contents);
	var mermaid = sequenceDiagram.toMermaid();
	console.log(mermaid);
	  // Output File
	fs.writeFile("output/testbulk"+i+".html", mermaid, function(err) {
	if(err) {
		return console.log(err);
	};

	console.log("The file was saved!");
	});
};
