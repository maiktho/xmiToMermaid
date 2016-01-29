var dom = require("xmldom");
var domparser = dom.DOMParser;
var xpath = require("xpath");


function XMI(){
	this.parse = function(filecontent){
		this.document = new domparser().parseFromString(filecontent);
		this.select = xpath.useNamespaces({
											'xmi': 'http://www.omg.org/spec/XMI/20131001',
											'uml' : 'http://www.eclipse.org/uml2/5.0.0/UML'
											}); 
		var name = this.select("//packagedElement/@name", this.document)[0].nodeValue;
		var lifelines = this.select("//lifeline", this.document);
		var messages = this.select("//message", this.document);
		
		this.sd = new SequenceDiagram(name);

		// iteriere über die gefundenen lifeline-Elemente und erzeuge ein jeweils neues Lifeline-Objekt mit ID und namen
		for (var i = 0; i < lifelines.length; i++){
			var name = lifelines[i].getAttribute("name");
			var id = lifelines[i].getAttribute("xmi:id");
			this.sd.addLifeline(new Lifeline(id, name));
		}
		

		// Iteriere über die gefundenen message-Elemente
		for (var i = 0; i < messages.length; i++){
			var id = messages[i].getAttribute("xmi:id");
			var name = messages[i].getAttribute("name");
			var type = messages[i].getAttribute("messageSort");
			
			// Finde die korrekte Empfänger-Lifeline mit Hilfe der receiveEventId und der zugehörigen MessageOccurrenceSpecification
			var receiveEventId = messages[i].getAttribute("receiveEvent");
			var receiveEventLifelineId = this.getLifelineIdFromMessageOccurranceSpecification(receiveEventId);
			var receiver = this.sd.getLifelineById(receiveEventLifelineId); 
			
			// Finde die korrekte Sender-Lifeline mit Hilfe der receiveEventId und der zugehörigen MessageOccurrenceSpecification
			var sendEventId = messages[i].getAttribute("sendEvent");
			var	sendEventLifelineId = this.getLifelineIdFromMessageOccurranceSpecification(sendEventId);
			var sender = this.sd.getLifelineById(sendEventLifelineId); 
			
			// Erzeuge ein neues Message-Objekt mit ID, Name, Empfänger (Referenz), Sender (Referenz), Art
			var message = new Message(id, name, sender, receiver, type);
			
			// Mit Hilfe der MessageOccurranceSpecification können wir herausfinden wo die Message eingefügt werden soll
			var msgOccNode = this.getMessageOccurranceNode(sendEventId);
			this.attachToCorrectParent(msgOccNode, message);
		}
		
		return this.sd;
	};
	
	

	this.attachToCorrectParent = function(xmlNode, modelElement){
		// Wenn das Parent-Element der Message ein "packagedElement" ist, füge das Element direkt als Kind des SequenceDiagram ein
		if(xmlNode.parentNode.nodeName == "packagedElement"){
			this.sd.addMoC(modelElement);
		} else {
			// suche ob es schon einen Combined mit der gefragten ID gibt (Achtung: doppelter parentNode-Sprung nötig!!)
			var parentContainer = this.sd.findMoCWithID(xmlNode.parentNode.parentNode.getAttribute("xmi:id"));
			if(parentContainer != null){
				// Falls es ihn schon gibt - füge das Element als Kind hinzu
				parentContainer.addMoC(modelElement);
			} else {
				// andernfalls erstelle ein neues Combined-Objekt und füge das ursprüngliche modelElement als Kind hinzu
				var id = xmlNode.parentNode.parentNode.getAttribute("xmi:id");
				var name = xmlNode.parentNode.parentNode.getAttribute("interactionOperator");
				var cf = new CombinedFragment(id, name);
				cf.addMoC(modelElement);
				
				// Nun nimm das neu erstellte Combined-Objekt und beginne die Suche, wo dieses eingefügt werden soll
				// Achtung: doppelter parentNode-Sprung da "operand"-tag zwischen Message Occurence Specification und Combined Fragment liegt
				this.attachToCorrectParent(xmlNode.parentNode.parentNode, cf);
			}
		}
	};
	
	// finde ads erste MessageOccurrance-Element für bestimmte ID
	this.getMessageOccurranceNode = function(msgOcId){
		var val = this.select("//fragment[@xmi:id='"+msgOcId+"']", this.document);
		return val[0];
	};
	
	// suche Lifeline von MessageOccurrance-Element für bestimmte ID
	this.getLifelineIdFromMessageOccurranceSpecification = function(msgOcId){
		var val = this.select("//fragment[@xmi:id='"+msgOcId+"']/@covered", this.document);
		return val[0].nodeValue;
	}
}

function SequenceDiagram(name){
	this.name = name;
	this.lifelines = [];
	this.messagesAndCombineds = [];

	// Füge ein Lifeline-Objekt dem SequenceDiagram zu
	this.addLifeline = function(lifeline){
		this.lifelines.push(lifeline);
	};
	// Füge ein Message- oder CombinedFragment-Objekt dem SequenceDiagram zu
	this.addMoC = function(moc){
		this.messagesAndCombineds.push(moc);
	};
	
	// Methode zum Suchen bereits erstellter Message- und Combined-Objekte anhand der ID
	// ruft die jeweilige findMoCWithID(id) in then einzelnen Objekten auf
	//  Messages und Combineds müssen diese Methode implementieren
	this.findMoCWithID = function(id){
		for(var i = 0; i < this.messagesAndCombineds.length; i++){
			var current = this.messagesAndCombineds[i];
			if(current.findMoCWithID(id) != null){
				return current.findMoCWithID(id);
			}
		}

		return null;
	};
	// Methode zum Suchen bestimmter Lifelines anhand der ID
	this.getLifelineById = function(id){
		for(var i = 0; i < this.lifelines.length; i++){
			if(this.lifelines[i].id === id){
				return this.lifelines[i];
			}
		}
		return null;
	};
	
	// Erzeuge den Code für die einzelnen Messages und Combineds
	// Außerdem wird der "HTML-wrapper" erzeugt
	this.toMermaid = function(){
		var retstring = "";
		retstring += "<html> \n<body>\n<script src=\"../lib/mermaid.min.js\"></script> \n<script>mermaid.initialize({startOnLoad:true});</script>\n<div class=\"mermaid\">\nsequenceDiagram \n";
		// Füge MessagesOrCombineds zu 
		for(var i = 0; i < this.messagesAndCombineds.length; i++){ 
			var moc = this.messagesAndCombineds[i];
			retstring += moc.toMermaid()+ "\n";
		}
		retstring += "</div>\n</body>\n</html>";
		return retstring;
	}
}

function Lifeline(id, name){
	this.id = id;
	this.name = name.replace(':','');
}

function CombinedFragment(id, name) {
	this.id = id;
	this.name = name;
	this.messagesAndCombineds = [];
	
	// Füge ein Message- oder CombinedFragment-Objekt ein
	this.addMoC = function(moc){
		this.messagesAndCombineds.push(moc);
	};
	
	// Methode zum Suchen bereits erstellter Message- und Combined-Objekte anhand der ID
	// ruft die jeweilige findMoCWithID(id) in then einzelnen Objekten auf
	// Messages und Combineds müssen diese Methode implementieren
	this.findMoCWithID = function(id){
		if(this.id == id){
			return this;
		} else {
			for(var i = 0; i < this.messagesAndCombineds.length; i++){
				var current = this.messagesAndCombineds[i];
				if(current.findMoCWithID(id) != null){
					return current.findMoCWithID(id);
				}
			}
		}
		
		return null;
	};
	
	// Bringe CombinedFragment in richtiges Format für Mermaid
	this.toMermaid = function(){
		var retstring = "";
		retstring += this.name+" "+this.id+"\n";
		
		// füge Messages die innerhalb des CombinedFragment liegen ein
		for(var i = 0; i < this.messagesAndCombineds.length; i++){ 
			var moc = this.messagesAndCombineds[i];
			retstring += moc.toMermaid()+ "\n";
		}
		//beende CombinedFragment
		retstring += "end";

		return retstring;
	}
	
	
}

function Message(id, name, snd, rec, type){
	this.id = id;
	this.name = name;
	this.sender = snd;
	this.receiver = rec;
	this.msgType = type;

	// Methode zum Suchen bereits erstellter Message- und Combined-Objekte anhand der ID
	// wird von Combined und SequenceDiagram aufgerufen
	this.findMoCWithID = function(id){
		if(this.id == id){
			return this;
		} else {
			return null;
		}
	};
	
	// bringe Messages in richtiges Format für Mermaid
	this.toMermaid = function(){
		return this.sender.name + this.msgTypeToMermaid() + this.receiver.name + ": "+this.name;
	};
	
	// Definiere Messagetyp mittels MessageSort 
	this.msgTypeToMermaid = function(){
		switch(this.msgType){
			case "reply" : return "-->";
			case "asynchCall" : return "->";
			default: return "->>";
		}
	}
}

exports.XMI = XMI;