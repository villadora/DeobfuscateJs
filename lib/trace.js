var $d_root = window || global;
$d_root.TRACE = {
    hits: {},
    enterFunction: function (fn, loc) {
        var key = fn + ':' + loc;
        if (this.hits.hasOwnProperty(key)) {
            this.hits[key] = this.hits[key] + 1;
        } else {
            this.hits[key] = 1;
        }
    },
    getHistogram: function () {
        var entry,
        sorted = [];
        for (entry in this.hits) {
            if (this.hits.hasOwnProperty(entry)) {
                sorted.push({ name: entry, count: this.hits[entry]});
            }
        }
        sorted.sort(function (a, b) {
            return b.count - a.count;
        });
        return sorted;
    }
};
