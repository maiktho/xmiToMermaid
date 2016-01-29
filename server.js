var fs = require("fs");
var dom = require("xmldom")
var domparser = dom.DOMParser;
var xpath = require("xpath");

var xmiLibrary = require("./lib/xmiLibrary");

// Input
var datafile = "data/test.xmi";
// var datafile = "data/model2.xmi";
// var datafile = "data/model.xml";


fs.readFile(datafile, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var xmi = new xmiLibrary.XMI();
  var sequenceDiagram = xmi.parse(data);
//   xmi.debugPrint();
//  return console.log(data);
  mermaid = sequenceDiagram.toMermaid();
  console.log(mermaid);
  // Output File
  fs.writeFile("data/test3.html", mermaid, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
}); 
});
