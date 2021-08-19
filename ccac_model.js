const svgns = "http://www.w3.org/2000/svg";

// Global mouse state
var drag = false;
var last_move = Date.now();
var cur_line = null;
var cur_index = null;

function svg_elem(svg, name, args, content=null) {
    let e = document.createElementNS(svgns, name);
    for (let k in args) {
	e.setAttributeNS(null, k, args[k]);
    }
    if (content != null) {
	e.appendChild(content);
    }
    svg.appendChild(e);
}

// Get the click pixel coordinates and find the logical coordinates in the
// graph. Also return the index of the point that was clicked (if any)
function click_location(evt, graph, line) {
    // Find out where the user clicked
    var pt = graph.svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    // The cursor point, translated into svg coordinates
    const gpt =  pt.matrixTransform(graph.svg.getScreenCTM().inverse());

    const cx = graph.x_val(gpt.x);
    const cy = graph.y_val(gpt.y);

    // Find out which square (if any) the user clicked
    var index = null;
    for (let i in line.pts) {
    	if (Math.abs(graph.x_coord(line.pts[i][0]) - gpt.x) <= graph.handle_side &&
            Math.abs(graph.y_coord(line.pts[i][1]) - gpt.y) <= graph.handle_side) {
	    index = i;
	    break;
    	}
    }

    return [cx, cy, index];
}


function onLineMouseDown(evt, graph, line_name) {
    const line = lines[line_name];
    const vals = click_location(evt, graph, line);
    const x = vals[0]; const y = vals[1]; const index = vals[2];

    if (index != null) {
	drag = true;
	cur_line = line.name;
	cur_index = index;
    }
}

function onLineDblClick(evt, graph, line) {
    const vals = click_location(evt, graph, lines[line]);
    const x = vals[0]; const y = vals[1]; const index = vals[2];

    const lines_clone = _.cloneDeep(lines); // jQuery.extend(true, {}, lines);
    if (index == null) {
	// Create a new point
	for (let i in lines[line].pts) {
	    if (i == 0)
		continue;
	    // Can we insert it here?
	    if (x >= lines[line].pts[i-1][0] &&
		x <= lines[line].pts[i][0]) {
		lines[line].pts.splice(i, 0, [x, lines[line].get_y(x)]);
		break;
	    }
	}
    }
    else {
	lines[line].pts.splice(index, 1);
    }

    const check = check_ccac_constraints(line);
    if (!check[0]) {
	lines = lines_clone;
	return;
    }
    graph.plot_line(lines[line]);
    for (let i in check[1]) {
	graph.plot_line(lines[check[1][i]]);
    }
}

function onLineMouseMove(evt, graph) {
    if (!drag || Date.now() - last_move < 10) {
	return;
    }
    last_move = Date.now();

    const index = cur_index;

    const vals = click_location(evt, graph, lines[cur_line]);
    const x = vals[0]; const y = vals[1];

    if (index != null) {
	// let bkp = line.pts[index];

	const lines_clone = _.cloneDeep(lines); //jQuery.extend(true, {}, lines);

	lines[cur_line].pts[index] = [x, y];
	const check = check_ccac_constraints(cur_line);
	// if (!check[0]) {
	//     line.pts[index][0] = bkp[0];
	//     line.pts[index][1] = bkp[1];
	//     document.getElementById("messages").innerHTML = check[2];
	//     return;
	// }

	if (!check[0]) {
	    lines = lines_clone;
	    document.getElementById("messages").innerHTML = check[2];
	    return;
	}

	graph.plot_line(lines[cur_line]);
	for (let i in check[1]) {
	    graph.plot_line(lines[check[1][i]]);
	}
    }
}

function onLineMouseUp(evt) {
    drag = false;
    cur_line = null;
    cur_index = null
}

// A line in a graph
class Line {
    // Takes a list of (x, y) pairs
    constructor(name, pts, color) {
	this.name = name;
	this.pts = pts;
	this.style = "stroke:"+color+";fill:"+color+";";
    }

    // Get the y coordinate at given x coordinate (returns null if out of range)
    get_y(x) {
	for (let i in this.pts) {
	    if (i == 0) {
		continue;
	    }
	    if (this.pts[i-1][0] > this.pts[i][0]) {
		console.log("Error: line's x coordinates are not increasing")
	    }
	    if (this.pts[i-1][0] <= x && this.pts[i][0] >= x) {
		return this.pts[i-1][1] + (this.pts[i][1] - this.pts[i-1][1]) * (x - this.pts[i-1][0]) / (this.pts[i][0] - this.pts[i-1][0]);
	    }
	}
    }
}

class Graph {
    constructor(svg_id, xrange, yrange) {
	this.svg_id = svg_id
	this.xrange = xrange;
	this.yrange = yrange
	this.svg = document.getElementById(svg_id);

	this.width = this.svg.width.baseVal.value;
	this.height = this.svg.height.baseVal.value;
	this.x0 = this.width * 0.1;
	this.y0 = this.height * 0.9;
	this.x1 = this.width * 0.9;
	this.y1 = this.height * 0.1;
	this.handle_side = 5;

	// Create the axes
	svg_elem(this.svg, "line", {
	    "x1": this.x0,
	    "y1": this.y0,
	    "x2": this.x1,
	    "y2": this.y0,
	    "style": "stroke:rgb(0,0,0);stroke-width:2"
	});
	svg_elem(this.svg, "line", {
	    "x1": this.x0,
	    "y1": this.y0,
	    "x2": this.x0,
	    "y2": this.y1,
	    "style": "stroke:rgb(0,0,0);stroke-width:2"
	});
	svg_elem(this.svg, "text", {
	    "x": (this.x0 + this.x1) / 2,
	    "y": (this.y0 + this.height) / 2,
	    "style": "stroke:rgb(0,0,0);stroke-width:1"
	}, document.createTextNode("Time (in RTTs)"));
	svg_elem(this.svg, "text", {
	    "x": this.x0 / 2,
	    "y": (this.y0 + this.y1) / 2,
	    "style": "stroke:rgb(0,0,0);stroke-width:1",
	    "transform": "rotate(-90 " + this.x0 / 2 + " " + (this.y0 + this.y1) / 2 + ")"
	}, document.createTextNode("Bytes (in BDP)"));

	for (let t = 0; t <= T; t += 1) {
	    svg_elem(this.svg, "line", {
		"x1": this.x_coord(t),
		"y1": this.y0 - 5,
		"x2": this.x_coord(t),
		"y2": this.y0 + 5,
		"style": "stroke:rgb(0,0,0);stroke-width:2"
	    });
	    svg_elem(this.svg, "text", {
		"x": this.x_coord(t) - 5,
		"y": this.y0 + 20,
		"style": "stroke:rgb(0,0,0);stroke-width:1"
	    }, document.createTextNode(t));
	}
	for (let b = 1; b * C < this.yrange[1]; b += 1) {
	    svg_elem(this.svg, "line", {
		"x1": this.x0 - 5,
		"y1": this.y_coord(b),
		"x2": this.x0 + 5,
		"y2": this.y_coord(b),
		"style": "stroke:rgb(0,0,0);stroke-width:2"
	    });
	    svg_elem(this.svg, "text", {
		"x": this.x0 - 15,
		"y": this.y_coord(b) + 5,
		"style": "stroke:rgb(0,0,0);stroke-width:1"
	    }, document.createTextNode(b));

	}
    }

    // From line coordinates to SVG coordinates
    x_coord(x) {
	return (x - this.xrange[0]) / (this.xrange[1] - this.xrange[0]) * (this.x1 - this.x0) + this.x0;
    }

    y_coord(y) {
	return this.y0 - (y - this.yrange[0]) / (this.yrange[1] - this.yrange[0]) * (this.y0 - this.y1);
    }

    // From SVG coordinates to line coordinates
    x_val(x) {
	return (x - this.x0) / (this.x1 - this.x0) * (this.xrange[1] - this.xrange[0]) + this.xrange[0];
    }

    y_val(y) {
	return (this.y0 - y) / (this.y1 - this.y0) * (this.yrange[0] - this.yrange[1]) + this.yrange[0];
    }

    plot_line(line) {
	let l = document.getElementById(this.svg_id + "-" + line.name);
	if (l == null) {
	    svg_elem(this.svg, "path", {
		"id": this.svg_id + "-" + line.name,
		"style": line.style,
		"class": "graph-line",
		"draggable": true,
	    });
	    l = document.getElementById(this.svg_id + "-" + line.name);
	    l.addEventListener("mousedown", function(evt) {onLineMouseDown(evt, graph, line.name);});
	    l.addEventListener("dblclick", function(evt) {onLineDblClick(evt, graph, line.name);});
	}

	// Make the path command
	let cmd = "M " + this.x_coord(line.pts[0][0]) + " " + this.y_coord(line.pts[0][1]);
	for (let i in line.pts) {
	    cmd += " L " + this.x_coord(line.pts[i][0]) + " " + this.y_coord(line.pts[i][1]);
	}
	// Come back so we do not form a filled area
	for (let i in line.pts) {
	    i = line.pts.length - i - 1;
	    cmd += " L " + this.x_coord(line.pts[i][0]) + " " + this.y_coord(line.pts[i][1]);
	}

	// Draw the squares
	const side = this.handle_side;
	for (let i in line.pts) {
	    let x = this.x_coord(line.pts[i][0]);
	    let y = this.y_coord(line.pts[i][1]);
	    cmd += " M " + (x - side/2) + " " + (y - side/2) +
		" h " + side + " v " + side + " h -" + side + " v -" + side;
	}

	l.setAttributeNS(null, "d", cmd);
	let graph = this;
    }
}

// This is the main point of this whole widget :) Returns true if the
// constraints are all satisfied. May change some other lines to satisfy the
// constraints. Takes the name of the line that was modified
function check_ccac_constraints(line_name) {
    var res = true;
    var changed = [];
    var msgs = "";


    // Fix the first and last points' x coordinates. Since we need to do this
    // anyway, it does not matter if we change and still return false
    var lower_anchor = 0, upper_anchor = T;
    if (line_name == "L") {
	lower_anchor = D;
	upper_anchor = T + D;
    }
    if (lines[line_name].pts[0][0] != lower_anchor) {
	lines[line_name].pts[0][0] = lower_anchor;
	changed.push(line_name);
	messages += "The first point is line_nameed to the left";
    }
    if (lines[line_name].pts[lines[line_name].pts.length-1][0] != upper_anchor) {
	lines[line_name].pts[lines[line_name].pts.length-1][0] = upper_anchor;
	changed.push(line_name);
	messages += "The last point is line_nameed to the right";
    }
    if (line_name == "U") {
	lines["L"] = new Line("L", lines["U"].pts.map(pt => [pt[0] + D, pt[1]]), "black")
	changed.push("L");
    }

    // Check monotonicity
    const monotones = ["A", "S", "L", "U"];
    for (let i in monotones) {
	const m = monotones[i];
	for (let j in lines[m].pts) {
	    if (j == 0) continue;
	    if (lines[m].pts[j-1][0] > lines[m].pts[j][0]) {
		msgs += "The " + m + " curve must be monotonic. ";
		return [false, changed, msgs];
	    }
	    if (lines[m].pts[j-1][1] > lines[m].pts[j][1]) {
		msgs += "The " + m + " curve must be monotonic. ";
		return [false, changed, msgs];
	    }
	}
    }

    // If U or L were modified, change the other one to match
    if (line_name == "U") {
	lines["L"] = new Line("L", lines["U"].pts.map(pt => [pt[0] + D, pt[1]]), "black")
    }
    if (line_name == "L") {
	lines["U"] = new Line("U", lines["L"].pts.map(pt => [pt[0] - D, pt[1]]), "black")
    }

    // Compare the following pairs of things. The first one must be <= the other
    const cmp = [["S", "A", "Cannot serve more packets than have arrived! Hence S(t) <= A(t) must hold. "],
		 ["S", "U", "We must have S(t) <= U(t) because we cannot transmit until we have enough tokens. "],
		 ["L", "S", "We must have L(t) <= S(t) since otherwise the tokens will expire. "]];
    for (let j in cmp) {
	const lo = cmp[j][0];
	const hi = cmp[j][1];
	const msg = cmp[j][2];

	for (let i in lines[lo].pts) {
	    const pt = lines[lo].pts[i];
	    if (pt[1] > lines[hi].get_y(pt[0])) {
		msgs += msg;
		return [false, changed, msgs];
	    }
	}
	for (let i in lines[hi].pts) {
	    const pt = lines[hi].pts[i];
	    if (pt[1] < lines[lo].get_y(pt[0])) {
		msgs += msg;
		return [false, changed, msgs];
	    }
	}
    }

    // Condition on the bounds
    const U = lines["U"].pts;
    const A = lines["A"].pts;
    for (let i in lines["U"].pts) {
	if (i == 0)
	    continue;
	const slope = (U[i][1] - U[i-1][1]) / (U[i][0] - U[i-1][0]);
	if (slope > C) {
	    msgs += "The slope of the bounds must be <= C, because that is the rate at which tokens arrive. ";
	    return [false, changed, msgs];
	}
	if (slope < C * (1 - 1e-6)) {
	    // See if waste is allowed here
	    if (U[i-1][1] < lines["A"].get_y(U[i-1][0]) ||
	        U[i][1] < lines["A"].get_y(U[i][0])) {
		msgs += "Waste (i.e. slope < C) can only happen when A(t) <= U(t). ";
		return [false, changed, msgs];
	    }
	    for (let j in A) {
		if (A[j][0] >= U[i-1][0] && A[j][0] <= U[i][0] &&
		    A[j][1] > lines["U"].get_y(A[j][0])) {
		    msgs += "Waste (i.e. slope < C) can only happen when A(t) <= U(t). ";
		    return [false, changed, msgs];
		}
	    }
	}
    }

    return [res, changed, msgs];
}

var D = 1;
var C = 1;
var buffer = 1;
var T = 5;
// Error margin
const epsilon = 1e-6;

// The set of lines
var lines = {
    "A": new Line("A", [[0, 0.5*C], [T, C*T + 0.5*C]], "blue"),
    "S": new Line("S", [[0, -0.5*C], [T, C*(T-0.1)]], "red"),
    "U": new Line("U", [[0, 0], [T, C*T]], "black"),
    "L": new Line("L", [[D, 0], [T+D, C*T]], "black"),
};

var cum;

$(document).ready(function() {
    cum = new Graph("cumulative_graph", [0, T + D], [0, 1.1 * C * T]);
    for (let line in lines) {
	cum.plot_line(lines[line]);
    }

    document.addEventListener("mouseup", onLineMouseUp);
    cum.svg.addEventListener("mousemove", function(evt) {onLineMouseMove(evt, cum);});
});
