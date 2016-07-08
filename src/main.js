var Chooser = React.createClass({
    render: function() {
        return <input type="file" id="audioFile" style={{color: 'white'}}></input>;
    }
});

ReactDOM.render(
    <Chooser />,
    document.getElementById('chooser')
);

window.audioContext = window.AudioContext || window.webkitAudioContext ||
                        window.mozAudioContext || window.msAudioContext;

var audioContext = new AudioContext();
var input = d3.select('#audioFile');
var visualizer = d3.select('#visualizer');
var currentSource;
var highColour = 'rgb(149,101,196)';
var lowColour = 'rgb(109,58,171)';

d3.select('body').style('background-color', 'rgb(61, 60, 58)');

var freqBins = [0, 8, 10, 12, 14, 16, 19, 23, 27, 32, 37, 44, 51, 61, 71, 83, 97,
                114, 134, 157, 185, 222, 259, 296, 352, 408, 482, 556, 649, 761,
                891, 1039, 1225, 1429, 1671, 2042, 2228, 2600, 3157, 3714, 4272];

function AudioSource(buffer) {
    var playing = false;
    var audioSource = this;

    this.freqBins = freqBins;
    this.bufferSource = audioContext.createBufferSource();
    this.analyser = audioContext.createAnalyser();
    this.bufferSource.connect(this.analyser);
    this.analyser.connect(audioContext.destination);
    this.analyser.fftSize = 16384;
    this.analyser.smoothingTimeConstant = 0;
    this.bufferSource.buffer = buffer;

    this.bufferSource.onended = function() {
        audioSource.end();
    };

    this.isPlaying = function() {
        return playing;
    };

    this.play = function(buffer) {
        this.bufferSource.start(0);
        currentSource = this;
        playing = true;
        this.getFreqArray();
    };

    this.getFreqArray = function() {
        if (playing) {
            var rawArray = new Uint8Array(this.analyser.frequencyBinCount);

            var freqArray = [];
            this.analyser.getByteFrequencyData(rawArray);
            for (var i = 1; i < this.freqBins.length; i++) {
                var values = [];
                for (var j = this.freqBins[i - 1]; j <= this.freqBins[i]; j++) {
                    values.push(rawArray[j]);
                }

                freqArray.push(Math.floor(d3.mean(values)));
            }

            draw(freqArray);
            var src = this;
            setTimeout(function() {
                src.getFreqArray(this.analyser);
            }, 10);
        }
    };

    this.stop = function() {
        this.bufferSource.stop(0);
    };

    this.end = function() {
        playing = false;
        var arr = new Uint8Array(this.analyser.frequencyBinCount);
        draw(arr);
    };
}

input.on('change', function () {
    var fr = new FileReader();
    fr.onload = function (e) {
        audioContext.decodeAudioData(e.target.result, function (buffer) {
            var audioSource = new AudioSource(buffer);
            if (currentSource !== undefined && currentSource.isPlaying()) {
                currentSource.bufferSource.onended = function() {
                    currentSource.end();
                    audioSource.play();
                }
                currentSource.stop();
            } else {
                audioSource.play();
            }
        });
    };

    fr.readAsArrayBuffer(input.node().files[0]);
});

var Chart = React.createClass({
    render: function() {
        return (
            <svg width={d3.select('body').node().getBoundingClientRect().width}
                height={d3.select('body').node().getBoundingClientRect().height}>{this.props.children}</svg>
        );
    }
});

var Bar = React.createClass({
    defaultProps: function() {
        return {
            width: 0,
            height: 0,
            x: 0
        };
    },

    render: function() {
        return (
            <rect fill={this.props.fill}
                width={this.props.width}
                height={this.props.height}
                x={this.props.x}
                y={this.props.chartHeight - this.props.height} />
        );
    }
});

var FreqSeries = React.createClass({
    defaultProps: function() {
        return {
            data: []
        };
    },

    render: function() {
        var props = this.props;

        var yScale = d3.scale.linear()
            .domain([0, 255])
            .range([0, this.props.height]);

        var xScale = d3.scale.ordinal()
            .domain(d3.range(this.props.data.length))
            .rangeBands([0, this.props.width], 0);

        var colourScale = d3.scale.linear()
            .domain([0, 255])
            .range([this.props.lowColour, this.props.highColour]);

        console.log(xScale.rangeBand());

        var bars = this.props.data.map(function(d, i) {
            return <Bar height={yScale(d)} width={xScale.rangeBand()} x={xScale(i)}
                chartHeight={props.height} fill={colourScale(d)} key={i} />;
        });

        return (
            <g>{bars}</g>
        );
    }
});

var Gradient = React.createClass({
    render: function() {
        var props = this.props;
        var gradients = this.props.data.map(function(d, i) {
            return (
                <linearGradient className={"barGradient"} id={"gradient" + i} gradientUnits={"userSpaceOnUse"}
                    x1={"0"} x2={"0"} y1={d3.select('#visualizer').node().getBoundingClientRect().top}
                    y2={d3.select('#visualizer').node().getBoundingClientRect().top + height} key={i}>
                    <stop offset={"0"} stopColor={props.topColour} stopOpacity={props.topOpacity} />
                    <stop offset={"1"} stopColor={props.bottomColour} stopOpacity={props.bottomOpacity} />
                </linearGradient>
            );
        });

        return (
            <defs>{gradients}</defs>
        );
    }
});

var Visualizer = React.createClass({
    render: function() {
        return (
            <Chart width={this.props.width} height={this.props.height}>
                <FreqSeries data={this.props.data} width={this.props.width} height={this.props.height}
                    highColour={this.props.highColour} lowColour={this.props.lowColour} />
            </Chart>
        );
    }
});

function draw(freqArray) {
    ReactDOM.render(
        <Visualizer data={freqArray} width={d3.select('body').node().getBoundingClientRect().width}
            height={d3.select('body').node().getBoundingClientRect().height}
            highColour={highColour} lowColour={lowColour} />,
        document.getElementById('visualizer')
    );
}
