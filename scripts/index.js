
CF_PORTAL_SIZE = 26;
CF_LINK_WIDTH = 3;


var Board = (function() {
    var is_cross_segment = function(ax, ay, bx, by, cx, cy, dx, dy) {
        var ta = (cx - dx) * (ay - cy) + (cy - dy) * (cx - ax);
        var tb = (cx - dx) * (by - cy) + (cy - dy) * (cx - bx);
        var tc = (ax - bx) * (cy - ay) + (ay - by) * (ax - cx);
        var td = (ax - bx) * (dy - ay) + (ay - by) * (ax - dx);

        return tc * td < 0 && ta * tb < 0;
    };
    var is_left = function(ax, ay, bx, by, px, py) {
        var n = px * (ay - by) + ax * (by - py) + bx * (py - ay);
        return n > 0;
    };
    var is_in_triangle = function(portal, cf) {
        return (
            is_left(cf.p1.x, cf.p1.y, cf.p2.x, cf.p2.y, portal.x, portal.y) &&
            is_left(cf.p2.x, cf.p2.y, cf.p3.x, cf.p3.y, portal.x, portal.y) &&
            is_left(cf.p3.x, cf.p3.y, cf.p1.x, cf.p1.y, portal.x, portal.y));
    };
    var get_link_portals_from = function(self, portal) {
        var results = []
        for (var i = 0; i < self.links.length; i++) {
            if (portal.id == self.links[i].from.id) {
                results.push(self.links[i].to);
            } else if (portal.id == self.links[i].to.id) {
                results.push(self.links[i].from);
            }
        }
        return results;
    };
    var intersects_portal = function(portals1, portals2) {
        var intersects = {}
        for (var i = 0; i < portals1.length; i++) {
            var id = portals1[i].id;
            if (!(id in intersects)) {
                intersects[id] = {
                    portal: portals1[i],
                    value: 0,
                }
            }
            intersects[id].value += 1;
        }
        for (var i = 0; i < portals2.length; i++) {
            var id = portals2[i].id;
            if (!(id in intersects)) {
                intersects[id] = {
                    portal: portals2[i],
                    value: 0,
                }
            }
            intersects[id].value += 2;
        }
        var results = [];
        for (var id in intersects) {
            if (intersects[id].value == 3) {
                results.push(intersects[id].portal);
            }
        }
        return results;
    };
    var max_area_portal = function(p1, p2, portals) {
        var result = null;
        var max_area = 0;
        for (var i = 0; i < portals.length; i++) {
            var p3 = portals[i];
            var area = (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) * 0.5;
            if (area < 0) {
                area *= -1;
            }
            if (area > max_area) {
                max_area = area;
                result = p3;
            }
        }
        return result;
    };

    function Board() {
        this.clear();
    }
    Board.prototype.clear = function() {
        this.portals = {};
        this.links = [];
        this.cfs = [];
    };
    Board.prototype.locate_portal = function(id, name, x, y, color) {
        this.portals[id] = {
            id: id,
            name: name,
            x: x,
            y: y,
            color: color,
        };
    };
    Board.prototype.capture_portal = function(id) {
        this.portals[id].color = this.portals[id].color == 'ENL' ? 'RES' : 'ENL';
        // remove links and control fields.
        for (var i = 0; i < this.links.length; i++) {
            var link = this.links[i];
            if (link.from.id == id || link.to.id == id) {
                this.links.splice(i, 1);
                i--;
            }
        }
        for (var i = 0; i < this.cfs.length; i++) {
            var cf = this.cfs[i];
            if (cf.p1.id == id || cf.p2.id == id || cf.p3.id == id) {
                this.cfs.splice(i, 1);
                i--;
            }
        }
    };
    Board.prototype.link = function(from, to) {
        var v = this.linkable(from, to);
        if (!v) {
            return;
        }

        var p1 = this.portals[from];
        var p2 = this.portals[to];

        this.links.push({
            from: p1,
            to: p2,
        });
        // create control fields
        var from_p1 = get_link_portals_from(this, p1);
        var from_p2 = get_link_portals_from(this, p2);
        var triangle_portals = intersects_portal(from_p1, from_p2);
        var left_portals = [];
        var right_portals = [];
        for (var i = 0; i < triangle_portals.length; i++) {
            var p = triangle_portals[i];
            if (is_left(p1.x, p1.y, p2.x, p2.y, p.x, p.y)) {
                left_portals.push(p);
            } else {
                right_portals.push(p);
            }
        }
        var left_portal = max_area_portal(p1, p2, left_portals);
        var right_portal = max_area_portal(p1, p2, right_portals);
        if (left_portal != null) {
            this.cfs.push({
                p1: p1,
                p2: p2,
                p3: left_portal,
            });
        }
        if (right_portal != null) {
            this.cfs.push({
                p1: p2,
                p2: p1,
                p3: right_portal,
            });
        }
    };
    Board.prototype.linkable = function(from, to) {
        var portal1 = this.portals[from];
        var portal2 = this.portals[to];
        // same portals
        if (portal1.id == portal2.id) {
            return false;
        }
        // difference color
        if (portal1.color != portal2.color) {
            return false;
        }
        // already linked
        for (var i = 0; i < this.links.length; i++) {
            var link = this.links[i];
            if (link.from.id == portal1.id && link.to.id == portal2.id ||
                link.from.id == portal2.id && link.to.id == portal1.id) {
                return false;
            }
        }
        // portal in a triangle
        for (var i = 0; i < this.cfs.length; i++) {
            var in_triangle = is_in_triangle(portal1, this.cfs[i]);
            if (in_triangle) {
                return false;
            }
        }
        // crossed link
        for (var i = 0; i < this.links.length; i++) {
            var link = this.links[i];
            var cross = is_cross_segment(portal1.x, portal1.y, portal2.x, portal2.y, link.from.x, link.from.y, link.to.x, link.to.y);
            if (cross) {
                return false;
            }
        }
        return true;
    };
    Board.prototype.hit_portal = function(px, py) {
        for (var id in this.portals) {
            var portal = this.portals[id];
            if (portal.x - CF_PORTAL_SIZE / 2 <= px && px <= portal.x + CF_PORTAL_SIZE / 2 &&
                portal.y - CF_PORTAL_SIZE / 2 <= py && py <= portal.y + CF_PORTAL_SIZE / 2) {
                return portal.id;
            }
        }
        return null;
    };
    Board.prototype.get_portal_info = function(id) {
        var portal = this.portals[id];
        var result = {
            name: portal.name,
            x: portal.x,
            y: portal.y,
            color: portal.color,
            in_link: 0,
            out_link: 0,
        };
      
        for (var i = 0; i < this.links.length; i++) {
            var link = this.links[i];
            if (link.from.id == id) {
                result.out_link += 1;
            }
            if (link.to.id == id) {
                result.in_link += 1;
            }
        }
        return result;
    };
    Board.prototype.get_info = function() {
        return {
            cf: this.cfs.length,
            link: this.links.length,
        };
    };

    Board.prototype.draw_portal = function(ctx, portal, selected) {
        var color;
        if (selected == portal.id) {
            color = 'rgba(0, 255, 255, 1.0)';
        } else {
            color = portal.color == 'ENL' ? 'rgba(0, 255, 0, 1.0)' : 'rgba(0, 0, 255, 1.0)';
        }
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.arc(portal.x, portal.y, CF_PORTAL_SIZE / 2, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.stroke();
    };
    Board.prototype.draw_link = function(ctx, link, view_arrow) {
        var color = link.from.color == 'ENL' ? 'rgba(0, 255, 0, 1.0)' : 'rgba(0, 0, 255, 1.0)';
        ctx.lineWidth = CF_LINK_WIDTH;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(link.from.x, link.from.y);
        ctx.lineTo(link.to.x, link.to.y);
        ctx.stroke();

        if (!view_arrow) return;

        // arrow
        var dx = link.from.x - link.to.x;
        var dy = link.from.y - link.to.y;
        if (dx == 0 && dy == 0) return;
        var angle = Math.atan2(dy, dx);
        var px = link.to.x + CF_PORTAL_SIZE / 2 * Math.cos(angle);
        var py = link.to.y + CF_PORTAL_SIZE / 2 * Math.sin(angle);
        var angle1 = angle + 15 * Math.PI / 180;
        var angle2 = angle - 15 * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(px + 20 * Math.cos(angle1), py + 20 * Math.sin(angle1));
        ctx.lineTo(px, py);
        ctx.lineTo(px + 20 * Math.cos(angle2), py + 20 * Math.sin(angle2));
        ctx.stroke();
    };
    Board.prototype.draw_control_field = function(ctx, cf) {
        var color = cf.p1.color == 'ENL' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(0, 0, 255, 0.3)';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cf.p1.x, cf.p1.y);
        ctx.lineTo(cf.p2.x, cf.p2.y);
        ctx.lineTo(cf.p3.x, cf.p3.y);
        ctx.closePath();
        ctx.fill();
    };
    Board.prototype.draw = function(ctx, selected, view_arrow) {
        for (var i = 0; i <  this.cfs.length; i++) {
            var cf = this.cfs[i];
            this.draw_control_field(ctx, cf);
        }
        for (var i = 0; i <  this.links.length; i++) {
            var link = this.links[i];
            this.draw_link(ctx, link, view_arrow);
        }
        for (var id in this.portals) {
            var portal = this.portals[id];
            this.draw_portal(ctx, portal, selected);
        }
    };

    return Board;
})();

var CommandList = (function() {
    function CommandList() {
        this.clear();
    }
    CommandList.prototype.clear = function() {
        this.portals = [];
        this.commands = [];
        this.current = 0;
        this.portal_id = 1;
    };
    CommandList.prototype.clear_without_portal = function() {
        this.commands = [];
        this.current = 0;
    };
    CommandList.prototype.incr_portal_id = function() {
        return this.portal_id++;
    };
    CommandList.prototype._add_command = function(command) {
        this.commands.splice(this.current, this.commands.length - this.current, command);
        this.current += 1;
    };
    CommandList.prototype.get_portals = function() {
        return this.portals;
    };
    CommandList.prototype.get_commands = function() {
        return this.commands;
    };
    CommandList.prototype.get_current = function() {
        return this.current;
    };
    CommandList.prototype.flip = function() {
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            portal.color = portal.color == 'ENL' ? 'RES' : 'ENL';
        }
    };
    CommandList.prototype.locate_portal = function(id, name, x, y, color) {
        this.portals.push({
            id: id,
            name: name,
            x: x,
            y: y,
            color: color,
            run: function(board) { board.locate_portal(this.id, this.name, this.x, this.y, this.color); },
        });
    };
    CommandList.prototype.remove_portal = function(id) {
        if (!this.is_portal_removable(id))
            return;
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            if (portal.id == id) {
                this.portals.splice(i, 1);
                break;
            }
        }
    };
    CommandList.prototype.is_portal_removable = function(id) {
        // a portal can remove if the portal is not used.
        for (var i = 0; i < this.commands.length; i++) {
            var command = this.commands[i];
            if (command.type == 'capture_portal') {
                if (command.id == id)
                    return false;
            } else if (command.type == 'link') {
                if (command.from == id || command.to == id)
                    return false;
            }
        }
        return true;
    };
    CommandList.prototype.change_name = function(id, name) {
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            if (portal.id == id) {
                portal.name = name;
            }
        }
    };
    CommandList.prototype.change_color = function(id, color) {
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            if (portal.id == id) {
                portal.color = color;
            }
        }
    };
    CommandList.prototype.capture_portal = function(id) {
        this._add_command({
            type: 'capture_portal',
            id: id,
            run: function(board) { board.capture_portal(id); },
        });
    };
    CommandList.prototype.link = function(from, to) {
        this._add_command({
            type: 'link',
            from: from,
            to: to,
            run: function(board) { board.link(from, to); },
        });
    };
    CommandList.prototype.set_current = function(current) {
        this.current = current;
    };
    CommandList.prototype.add_current = function(num) {
        this.current += num;
        if (this.current < 0) this.current = 0;
        if (this.current > this.commands.length) this.current = this.commands.length;
    }
    CommandList.prototype.apply = function(board, value) {
        if (value === undefined) {
            value = this.current;
        }
        board.clear();
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            portal.run(board);
        }
        for (var i = 0; i < value; i++) {
            var command = this.commands[i];
            command.run(board);
        }
    };
    CommandList.prototype.get_info = function() {
        var result = {
            current: null,
            all: null,
        };
        var board = new Board();
        this.apply(board);
        var current = board.get_info();
        current['portals'] = {}
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            current['portals'][portal.id] = board.get_portal_info(portal.id);
        }
        result.current = current;

        this.apply(board, this.commands.length);
        var all = board.get_info();
        all['portals'] = {}
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            all['portals'][portal.id] = board.get_portal_info(portal.id);
        }
        result.all = all;

        /*
        {
            current: {
                cf: <number>,
                link: <number>,
                portals: {
                    <string>(id): {
                        name: <string>,
                        x: <number>,
                        y: <number>,
                        color: <string>,
                        in_link: <number>,
                        out_link: <number>,
                    },
                    <string>(id): {
                        ...
                    },
                },
            },
            all: {
                ...
            },
        }
        */
        return result;
    };

    var ENCODE_STR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var DECODE_OBJ = {};
    for (var i = 0; i < ENCODE_STR.length; i++) {
        DECODE_OBJ[ENCODE_STR[i]] = i;
    }
    var serialize_int = function(num) {
        // 5bit compressed encoding.
        var result = '';
        while (num >= 32) {
            result += ENCODE_STR[(num & 0x1f) + 32];
            num >>= 5;
        }
        result += ENCODE_STR[num];

        return result;
    };
    var serialize_string = function(str) {
        var result = '';
        str = encodeURIComponent(str);
        result += serialize_int(str.length);
        result += str;
        return result;
    };
    var deserialize_int = function(str) {
        var result = 0;
        var n = 0;
        while (true) {
            var v = DECODE_OBJ[str[0]];
            str = str.slice(1);
            if (v >= 32) {
                result += (v - 32) << (n * 5);
            } else {
                result = (v << (n * 5)) + result;
                break;
            }
            n++;
        }
        return { result: result, remain: str };
    };
    var deserialize_string = function(str) {
        var x = deserialize_int(str);
        return { result: decodeURIComponent(x.remain.slice(0, x.result)), remain: x.remain.slice(x.result) };
    };
    CommandList.prototype.to_string = function() {
        var str = '';
        str += serialize_int(this.portal_id);
        str += serialize_int(this.current);

        str += serialize_int(this.portals.length);
        for (var i = 0; i < this.portals.length; i++) {
            var portal = this.portals[i];
            str += serialize_int(portal.id);
            str += serialize_string(portal.name);
            str += serialize_int(portal.x);
            str += serialize_int(portal.y);
            str += portal.color == 'ENL' ? 'e' : 'r';
        }
        str += serialize_int(this.commands.length);
        for (var i = 0; i < this.commands.length; i++) {
            var command = this.commands[i];
            if (command.type == 'capture_portal') {
                str += 'c';
                str += serialize_int(command.id);
            } else if (command.type == 'link') {
                str += 'l';
                str += serialize_int(command.from);
                str += serialize_int(command.to);
            }
        }
        return str;
    };
    CommandList.prototype.from_string = function(str) {
        var remain = str;

        var t = deserialize_int(remain);
        this.portal_id = t.result;
        remain = t.remain;

        var t = deserialize_int(remain);
        var current = t.result;
        remain = t.remain;

        var t = deserialize_int(remain);
        var portal_length = t.result;
        remain = t.remain;

        for (var i = 0; i < portal_length; i++) {
            t = deserialize_int(remain);
            var id = t.result;
            remain = t.remain;

            t = deserialize_string(remain);
            var name = t.result;
            remain = t.remain;

            t = deserialize_int(remain);
            var x = t.result;
            remain = t.remain;

            t = deserialize_int(remain);
            var y = t.result;
            remain = t.remain;

            color = remain[0] == 'e' ? 'ENL' : 'RES';
            remain = remain.slice(1);

            this.locate_portal(id, name, x, y, color);
        }

        var t = deserialize_int(remain);
        var command_length = t.result;
        remain = t.remain;

        for (var i = 0; i < command_length; i++) {
            var type = remain[0];
            remain = remain.slice(1);
            if (type == 'c') {
                t = deserialize_int(remain);
                var id = t.result;
                remain = t.remain;

                this.capture_portal(id);
            } else if (type == 'l') {
                t = deserialize_int(remain);
                var from = t.result;
                remain = t.remain;

                t = deserialize_int(remain);
                var to = t.result;
                remain = t.remain;

                this.link(from, to);
            }
        }
        this.set_current(current);
    };
    return CommandList;
})();

// Fisher-Yates algorithm
Array.prototype.shuffle = function() {
    var i = this.length;
    while (i) {
        var j = Math.floor(Math.random() * i);
        var t = this[--i];
        this[i] = this[j];
        this[j] = t;
    }
    return this;
}



var Preset = (function() {
    function Preset() {
    }
    Preset.prototype.preset = function(name, target, color, generate_id) {
      
      var rcolor = $("#faction").val() == 'ENL' ? 'RES' : 'ENL';
        if (name == 'basic1' || name == 'basic2') {
            var a = generate_id();
            var b = generate_id();
            var c = generate_id();
            var p = generate_id();
            target.locate_portal(a, 'a', 200, 100, rcolor);
            target.locate_portal(b, 'b', 113, 250, rcolor);
            target.locate_portal(c, 'c', 287, 250, rcolor);
            target.locate_portal(p, 'p', 200, 200, rcolor);
        }
        if (name == 'basic1') {
            target.capture_portal(b);
            target.capture_portal(c);
            target.link(c, b);
            target.capture_portal(p);
            target.link(p, b);
            target.link(p, c);
            target.capture_portal(a);
            target.link(a, b);
            target.link(a, c);
            target.link(a, p);
        }
        if (name == 'basic2') {
            target.capture_portal(p);
            target.capture_portal(a);
            target.capture_portal(b);
            target.capture_portal(c);
            target.link(a, b);
            target.link(b, c);
            target.link(c, a);
            target.link(a, p);
            target.link(b, p);
            target.link(c, p);
        }
        if (name == 'oneway1' || name == 'oneway2') {
            var a = generate_id();
            var b = generate_id();
            var p1 = generate_id();
            var p2 = generate_id();
            var p3 = generate_id();
            var p4 = generate_id();
            target.locate_portal(a, 'a', 50, 340, rcolor);
            target.locate_portal(b, 'b', 350, 340, rcolor);
            target.locate_portal(p1, 'p1', 200, 270, rcolor);
            target.locate_portal(p2, 'p2', 200, 200, rcolor);
            target.locate_portal(p3, 'p3', 200, 130, rcolor);
            target.locate_portal(p4, 'p4', 200, 60, rcolor);
        }
        if (name == 'oneway3') {
            var ps = [];
            for (var i = 0; i < 39; i++) {
                ps[i] = generate_id();
                target.locate_portal(ps[i], 'a' + ps[i], 200, 370 - i * 9, rcolor);
            }
            var b = generate_id();
            var c = generate_id();
            target.locate_portal(b, 'b', 30, 390, rcolor);
            target.locate_portal(c, 'c', 370, 390, rcolor);
        }
        if (name == 'oneway1') {
            target.capture_portal(a);
            target.capture_portal(b);
            target.link(b, a);
            target.capture_portal(p1);
            target.link(p1, a);
            target.link(p1, b);
            target.capture_portal(p2);
            target.link(p2, a);
            target.link(p2, b);
            target.link(p2, p1);
            target.capture_portal(p3);
            target.link(p3, a);
            target.link(p3, b);
            target.link(p3, p2);
            target.capture_portal(p4);
            target.link(p4, a);
            target.link(p4, b);
            target.link(p4, p3);
        }
        if (name == 'oneway2') {
            target.capture_portal(p4);
            target.capture_portal(p3);
            target.link(p3, p4);
            target.capture_portal(p2);
            target.link(p2, p3);
            target.capture_portal(p1);
            target.link(p1, p2);
            target.capture_portal(a);
            target.link(a, p4);
            target.link(a, p3);
            target.link(a, p2);
            target.link(a, p1);
            target.capture_portal(b);
            target.link(b, a);
            target.link(b, p4);
            target.link(b, p3);
            target.link(b, p2);
            target.link(b, p1);
        }
        if (name == 'oneway3') {
            target.capture_portal(b);
            target.capture_portal(c);
            target.link(c, b);
            ps.shuffle();
            for (var i = 0; i < ps.length; i++) {
                target.capture_portal(ps[i]);
                target.link(b, ps[i]);
                target.link(c, ps[i]);
            }
        }
        if (name == 'twoway1' || name == 'twoway2') {
            var a1 = generate_id();
            var a2 = generate_id();
            var a3 = generate_id();
            var a4 = generate_id();
            var b1 = generate_id();
            var b2 = generate_id();
            var b3 = generate_id();
            var b4 = generate_id();
            var c = generate_id();
            target.locate_portal(c, 'c', 200, 300, rcolor);
            target.locate_portal(a1, 'a1', 240, 170, rcolor);
            target.locate_portal(a2, 'a2', 280, 140, rcolor);
            target.locate_portal(a3, 'a3', 320, 110, rcolor);
            target.locate_portal(a4, 'a4', 360, 80, rcolor);
            target.locate_portal(b1, 'b1', 160, 170, rcolor);
            target.locate_portal(b2, 'b2', 120, 140, rcolor);
            target.locate_portal(b3, 'b3', 80, 110, rcolor);
            target.locate_portal(b4, 'b4', 40, 80, rcolor);
        }
        if (name == 'twoway1') {
            target.capture_portal(c);
            target.capture_portal(a1);
            target.link(a1, c);
            target.capture_portal(b1);
            target.link(b1, c);
            target.link(b1, a1);
            target.capture_portal(a2);
            target.link(a2, c);
            target.link(a2, b1);
            target.link(a2, a1);
            target.capture_portal(b2);
            target.link(b2, c);
            target.link(b2, a2);
            target.link(b2, b1);
            target.capture_portal(a3);
            target.link(a3, c);
            target.link(a3, b2);
            target.link(a3, a2);
            target.capture_portal(b3);
            target.link(b3, c);
            target.link(b3, a3);
            target.link(b3, b2);
            target.capture_portal(a4);
            target.link(a4, c);
            target.link(a4, b3);
            target.link(a4, a3);
            target.capture_portal(b4);
            target.link(b4, c);
            target.link(b4, a4);
            target.link(b4, b3);
        }
        if (name == 'twoway2') {
            target.capture_portal(a4);
            target.capture_portal(a3);
            target.link(a3, a4);
            target.capture_portal(a2);
            target.link(a2, a3);
            target.capture_portal(a1);
            target.link(a1, a2);
            target.capture_portal(b1);
            target.link(b1, a1);
            target.link(b1, a2);
            target.capture_portal(b2);
            target.link(b2, b1);
            target.link(b2, a2);
            target.link(b2, a3);
            target.capture_portal(b3);
            target.link(b3, b2);
            target.link(b3, a3);
            target.link(b3, a4);
            target.capture_portal(b4);
            target.link(b4, b3);
            target.link(b4, a4);
            target.capture_portal(c);
            target.link(c, b4);
            target.link(c, a4);
            target.link(c, b3);
            target.link(c, a3);
            target.link(c, b2);
            target.link(c, a2);
            target.link(c, b1);
            target.link(c, a1);
        }
        if (name == 'threeway1' || name == 'threeway2') {
            var a1 = generate_id();
            var a2 = generate_id();
            var a3 = generate_id();
            var a4 = generate_id();
            var b1 = generate_id();
            var b2 = generate_id();
            var b3 = generate_id();
            var b4 = generate_id();
            var c1 = generate_id();
            var c2 = generate_id();
            var c3 = generate_id();
            var c4 = generate_id();
            target.locate_portal(a1, 'a1', 240, 130, rcolor);
            target.locate_portal(a2, 'a2', 280, 100, rcolor);
            target.locate_portal(a3, 'a3', 320, 70, rcolor);
            target.locate_portal(a4, 'a4', 360, 40, rcolor);
            target.locate_portal(b1, 'b1', 160, 130, rcolor);
            target.locate_portal(b2, 'b2', 120, 100, rcolor);
            target.locate_portal(b3, 'b3', 80, 70, rcolor);
            target.locate_portal(b4, 'b4', 40, 40, rcolor);
            target.locate_portal(c1, 'c1', 200, 210, rcolor);
            target.locate_portal(c2, 'c2', 200, 260, rcolor);
            target.locate_portal(c3, 'c3', 200, 310, rcolor);
            target.locate_portal(c4, 'c4', 200, 360, rcolor);
        }
        if (name == 'threeway1') {
            target.capture_portal(a1);
            target.capture_portal(b1);
            target.link(b1, a1);
            target.capture_portal(c1);
            target.link(c1, b1);
            target.link(a1, c1);
            target.capture_portal(a2);
            target.link(a2, c1);
            target.link(a2, b1);
            target.link(a2, a1);
            target.capture_portal(b2);
            target.link(b2, a2);
            target.link(b2, c1);
            target.link(b2, b1);
            target.capture_portal(c2);
            target.link(c2, b2);
            target.link(c2, a2);
            target.link(c2, c1);
            target.capture_portal(a3);
            target.link(a3, c2);
            target.link(a3, b2);
            target.link(a3, a2);
            target.capture_portal(b3);
            target.link(b3, a3);
            target.link(b3, c2);
            target.link(b3, b2);
            target.capture_portal(c3);
            target.link(c3, b3);
            target.link(c3, a3);
            target.link(c3, c2);
            target.capture_portal(a4);
            target.link(a4, c3);
            target.link(a4, b3);
            target.link(a4, a3);
            target.capture_portal(b4);
            target.link(b4, a4);
            target.link(b4, c3);
            target.link(b4, b3);
            target.capture_portal(c4);
            target.link(c4, b4);
            target.link(c4, a4);
            target.link(c4, c3);
        }
        if (name == 'threeway2') {
            target.capture_portal(a4);
            target.capture_portal(a3);
            target.link(a3, a4);
            target.capture_portal(a2);
            target.link(a2, a3);
            target.capture_portal(a1);
            target.link(a1, a2);
            target.capture_portal(b1);
            target.link(b1, a1);
            target.link(b1, a2);
            target.capture_portal(b2);
            target.link(b2, b1);
            target.link(b2, a2);
            target.link(b2, a3);
            target.capture_portal(b3);
            target.link(b3, b2);
            target.link(b3, a3);
            target.link(b3, a4);
            target.capture_portal(b4);
            target.link(b4, b3);
            target.link(b4, a4);
            target.capture_portal(c1);
            target.link(c1, b2);
            target.link(c1, a2);
            target.link(c1, b1);
            target.link(c1, a1);
            target.capture_portal(c2);
            target.link(c2, b3);
            target.link(c2, a3);
            target.link(c2, b2);
            target.link(c2, a2);
            target.link(c2, c1);
            target.capture_portal(c3);
            target.link(c3, b4);
            target.link(c3, a4);
            target.link(c3, b3);
            target.link(c3, a3);
            target.link(c3, c2);
            target.capture_portal(c4);
            target.link(c4, b4);
            target.link(c4, a4);
            target.link(c4, c3);
        }
    };
    return Preset;
})();

$(function() {
    var faction = 'RES';
    var canvas = $('#canvas');
    var ctx = canvas[0].getContext('2d');
    var scale = 1;
    var clear = function() {
        var w = window.innerWidth
        || document.documentElement.clientWidth
        || document.body.clientWidth;

        var h = window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight;
        ctx.canvas.width = w-50;
				ctx.canvas.height = h-200;
        ctx.scale(scale,scale);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'blue';
				ctx.lineWidth = '1';
				ctx.strokeRect(0, 0, canvas.width, canvas.height);
    };
    clear();
    var board = new Board();
    var command_list = new CommandList();
    var selected = null;
    var preset = new Preset();

    $(window).on('resize',function() {
        var w = window.innerWidth
        || document.documentElement.clientWidth
        || document.body.clientWidth;

        var h = window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight;
        ctx.canvas.width = w-50;
				ctx.canvas.height = h-200;
        update();

      }
    );

    $(document).on('click', '#command-list > a', function(e) {
        e.preventDefault();
        var index = $(this).attr('data-index');
        command_list.set_current(parseInt(index));
        update();
    });
    $(document).on('change', '#zoom1,#zoom2,#zoom3', function(e) {
      //I'd prefer this to work with a slider but test for now.
      if(e.target.id == "zoom1"){
        alert(e.target.id);
        scale=0.5;
      }else if(e.target.id =="zoom2"){
        alert(e.target.id);
        scale=1;
      }else if(e.target.id == "zoom3"){
        alert(e.target.id);
        scale=1.5;
      }else{
        scale=1;
      }
      update();

    });
    var update = function() {
        command_list.apply(board);
        update_command_list();
        clear();
        //ctx.scale(scale,scale);
        board.draw(ctx, selected, $("#view-arrow").prop('checked'));
        update_share_link();
        update_portal_info();
        update_command_operators();
    };
  
  
    var update_share_link = function() {
        var str = command_list.to_string();
        var loc = window.location;
        $('#share').attr('href', loc.protocol + '//' + loc.host + loc.pathname + '?p=' + str + loc.hash);
    };
    var update_portal_info = function() {
        var info = command_list.get_info();
        for (var id in info.current.portals) {
            var portal = info.current.portals[id];
            var elem = $('.portal-info-' + id);
            elem.find('.x').text(portal.x);
            elem.find('.y').text(portal.y);
            elem.find('.current-in-link').text(portal.in_link);
            elem.find('.current-out-link').text(portal.out_link);
        }
        for (var id in info.all.portals) {
            var portal = info.all.portals[id];
            var elem = $('.portal-info-' + id);
            elem.find('.in-link').text(portal.in_link);
            elem.find('.out-link').text(portal.out_link);
        }
        $('#portal-info .current-cf').text(info.current.cf);
        $('#portal-info .current-link').text(info.current.link);
        $('#portal-info .cf').text(info.all.cf);
        $('#portal-info .link').text(info.all.link);
    };
    var update_command_operators = function() {
        var commands = command_list.get_commands();
        var current = command_list.get_current();
        console.log(current);
        console.log(commands.length);
        if (current == 0) {
            $('#prev-command').hide();
        } else {
            $('#prev-command').show();
        }
        if (current == commands.length) {
            $('#next-command').hide();
        } else {
            $('#next-command').show();
        }
    };
    $(document).keydown(function(e){
        if (e.keyCode == 38) { // up
            command_list.add_current(-1);
        }
        if (e.keyCode == 40) { // down
            command_list.add_current(1);
        }
        if (e.keyCode == 38 || e.keyCode == 40) {
            update();
            return false;
        }
    });
  
   $(document).on('change', '#faction', function(e) {
        faction = ($(this).val()=='RES' ? "RES" : "ENL");
        $('#faction').selectpicker('setStyle', 'btn-primary', 'remove');
        $('#faction').selectpicker('setStyle', 'btn-success', 'remove');
        $('#faction').selectpicker('setStyle',   (faction=='RES' ? 'btn-primary' : 'btn-success'), 'add');
    });
  
  
    $(document).on('change', '#portal-list .portal-name', function(e) {
        var text = $(this).val();
        var id = parseInt($(this).closest('li').attr('data-id'), 10);
        command_list.change_name(id, text);
        update();
    });
    

    $(document).on('click', '#portal-list button.close[type="button"]', function(e) {
        var li = $(this).closest('li');
        command_list.remove_portal(parseInt(li.attr('data-id')));
        li.remove();
        update();
    });
    $(document).on('change', '#portal-list input.initial-group', function(e) {
        var id = parseInt($(this).closest('li').attr('data-id'));
        var color = $(this).attr('value');
        command_list.change_color(id, color);
        update();
    });
    $('#clear').on('click', function(e) {
        command_list.clear();
        update();
    });
    $('#clear-without-portal').on('click', function(e) {
        command_list.clear_without_portal();
        update();
    });
    $('#flip').on('click', function(e) {
        command_list.flip();
        update();
    });
    $('.preset').on('click', function(e) {
        command_list.clear();
        preset.preset($(this).attr('data-name'), command_list, 'ENL', function() { return command_list.incr_portal_id(); });
        update();
    });
    $('#view-arrow').change(function(e) {
        update();
    });
    $('#prev-command').click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        command_list.add_current(-1);
        update();
    });
    $('#next-command').click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        command_list.add_current(1);
        update();
    });

    var update_command_list = function() {
        var tmpl = (
            '<li class="list-group-item" data-id="$id$">' +
            '  <button type="button" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
            '  <div class="form-group">' +
            '   <label>Portal name</label>' +
            '   <input type="text" class="form-control input-sm portal-name">' +
            '  </div>' +
            '  <div class="form-group">' +
            '    <label>Initial Side</label>' +
            '    <label class="radio-inline">' +
            '      <input type="radio" class="initial-group" name="group-$id$" value="ENL">ENL' +
            '    </label>' +
            '    <label class="radio-inline">' +
            '      <input type="radio" class="initial-group" name="group-$id$" value="RES">RES' +
            '    </label>' +
            '  </div>' +
            '  <p class="portal-info-$id$"><small>link # IN/OUT:</small> <span class="in-link">5</span>(<span class="current-in-link">3</span>) / <span class="out-link">4</span>(<span class="current-out-link">1</span>)</p>' +
            '</li>' +
            '');
        var portals = command_list.get_portals();
        var portalobj = {}
        for (var i = 0; i < portals.length; i++) {
            var portal = portals[i];
            portalobj[portal.id] = portal;
        }

        var $portal_list = $('#portal-list');
        var bottomScrolled = $portal_list.prop('scrollHeight') <= $portal_list.scrollTop() + $portal_list.height();
        $portal_list.empty();
        for (var i = 0; i < portals.length; i++) {
            var portal = portals[i];
            html = tmpl.replace(/\$id\$/g, portal.id);
            var elem = $(html);
            elem.find('.portal-name').val(portal.name).attr('data-original', portal.name);
            elem.find('input[type="radio"][name="group-' + portal.id + '"][value="' + portal.color + '"]').prop('checked', true);
            if (!command_list.is_portal_removable(portal.id)) {
                elem.find('button.close[type="button"]').remove();
                elem.find('input.initial-group').prop('disabled', true);
            }
            $portal_list.append(elem);
        }
        // scroll
        if (bottomScrolled) {
            $portal_list.scrollTop($portal_list.prop('scrollHeight') - $portal_list.height());
        }

        var commands = command_list.get_commands();
        var current = command_list.get_current();
        var current_elem = null;
        var $command_list = $('#command-list');
        var scroll = $('#command-list').scrollTop();
        $command_list.empty();
        var i = 0
        var elem = $('<a>').attr('href', '#').attr('data-index', i).addClass('list-group-item').text('');
        if (i == current) {
            elem.addClass('active');
            current_elem = elem;
        }
        $command_list.append(elem);
        for ( ; i < commands.length; i++) {
            var command = commands[i];
            var text;
            if (command.type == 'capture_portal') {
                text = 'Portal ' + portalobj[command.id].name + ' captured';
            } else if (command.type == 'link') {
                text = 'Portal ' + portalobj[command.from].name + ' linked to portal ' + portalobj[command.to].name;
            }

            var elem = $('<a>').attr('href', '#').attr('data-index', i + 1).addClass('list-group-item').text(text);
            if (i + 1 == current) {
                elem.addClass('active');
                current_elem = elem;
            }
            $command_list.append(elem);
        }
        // scroll
        var height = $('#command-list').height();
        var top = current_elem.position().top;
        var elem_height = current_elem.outerHeight();
        if (top < 0) {
            $('#command-list').scrollTop(top + scroll);
        }
        if (top + elem_height > height) {
            $('#command-list').scrollTop(top + scroll + elem_height - height);
        }
    };

    var get_mouse_point = function(e, element) {
      var x, y;
      if (e.changedTouches === undefined) {
        x = e.pageX;
        y = e.pageY;
      } else {
        x = e.changedTouches[0].pageX;
        y = e.changedTouches[0].pageY;
      }
      var offset = $(element).offset();
      x = x - offset.left;
      y = y - offset.top;
      return { x: x, y: y };
    };

    $('#canvas').on('ouchstart mousedown', function(e) {
        e.preventDefault();
        var p = get_mouse_point(e, this);
        var hit = board.hit_portal(p.x, p.y);
        if (hit == null) {
            if (selected == null) {
                var portal_id = command_list.incr_portal_id();
                command_list.locate_portal(portal_id, portal_id.toString(10), Math.floor(p.x), Math.floor(p.y), faction);
            } else {
                selected = null;
            }
        } else {
            if (selected == null) {
                selected = hit;
            } else {
                if (hit == selected) {
                    command_list.capture_portal(hit);
                    selected = null;
                } else {
                    if (board.linkable(selected, hit)) {
                      command_list.link(selected, hit);
                    }
                    selected = null;
                }
            }
        }
        update();
    });

    function get_url_vars() {
        var vars = []
        var hash;
        var hashes = window.location.search.slice(1).split('&');
        for(var i = 0; i < hashes.length; i++) {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return vars;
    }

    var vars = get_url_vars();
    if ('p' in vars && vars['p'].length != 0) {
        command_list.from_string(vars['p']);
    }
    update();
});
