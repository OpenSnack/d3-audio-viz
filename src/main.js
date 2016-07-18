var globalVolume = 1;
var currentSource;
var mouseIsDown = false;
var clickingVolume = false;

d3.select(document).on('mouseout', function() {
    if (d3.event.relatedTarget === null || d3.event.toElement === null) {
        mouseIsDown = false;
        clickingVolume = false;
    }
});

d3.select('#topPanel').on('mouseup', function() { mouseIsDown = false; clickingVolume = false; });

var highColour = 'rgb(149,101,196)';
var lowColour = 'rgb(109,58,171)';
var eqColour = 'rgb(86,101,199)';

var Chooser = React.createClass({
    render: function() {
        return (<div id="uploadButton">
                    <label htmlFor="audioFile">Choose a song</label>
                    <input type="file" id="audioFile" accept="audio/*" />
                </div>);
    }
});

var ResetEQ = React.createClass({
    buttonClick: function() {
        if (currentSource) {
            currentSource.resetEQ();
        }
    },

    render: function() {
        return <div onClick={this.buttonClick} id="resetEQButton">Reset EQ</div>;
    }
});

var Volume = React.createClass({

    setVolume: function(e) {
        var newWidth = e.pageX - d3.select('#volumeClick').node().getBoundingClientRect().left;
        globalVolume = newWidth / e.target.getBoundingClientRect().width;
        if (currentSource) {
            currentSource.setGain(globalVolume);
            if (!currentSource.isPlaying()) {
                renderVolume();
            }
        } else {
            renderVolume();
        }
    },

    mouseDown: function(e) {
        mouseIsDown = true;
        clickingVolume = true;
        this.setVolume(e);
    },

    mouseMove: function(e) {
        if (mouseIsDown && clickingVolume) {
            this.setVolume(e);
        }
    },

    mouseUp: function(e) {
        mouseIsDown = false;
        clickingVolume = false;
    },

    render: function() {
        return (<svg width={this.props.width} height={this.props.height}>
                    <rect onMouseDown={this.mouseDown} onMouseMove={this.mouseMove} onMouseUp={this.mouseUp}
                        onMouseUp={this.mouseUp} x={0} y={0} fill={'black'} id={'volumeClick'}
                        width={this.props.width} height={this.props.height} />
                    <rect x={0} y={0} fill={this.props.fill} id={'currentVolume'}
                        width={this.props.currentWidth} height={this.props.height} />
                    <text className={'volumeLeft'} x={'10'} y={this.props.height / 2}>0</text>
                    <text className={'volumeRight'} x={this.props.width - 10} y={this.props.height / 2}>100</text>
                </svg>);
    }
});

ReactDOM.render(
    <Chooser />,
    document.getElementById('chooser')
);

ReactDOM.render(
    <ResetEQ />,
    document.getElementById('resetEQ')
);

function renderVolume() {
    var controlsRect = d3.select('#topPanel').node().getBoundingClientRect();
    ReactDOM.render(
        <Volume width={controlsRect.width / 2} currentWidth={(controlsRect.width / 2) * globalVolume}
            height={controlsRect.height} fill={highColour} />,
        document.getElementById('volume')
    );
}

window.onresize = renderVolume;

renderVolume();

window.audioContext = window.AudioContext || window.webkitAudioContext ||
                        window.mozAudioContext || window.msAudioContext;

var audioContext = new AudioContext();
var input = d3.select('#audioFile');
var visualizer = d3.select('#visualizer');

d3.select('body').style('background-color', 'rgb(61, 60, 58)');

var centerFreqs = [53.8, 64.6, 75.4, 88.8, 102.3, 118.4, 140, 164.2, 191.1, 223.4, 261.1,
                    306.8, 360.7, 419.9, 492.6, 576, 672.9, 788.7, 923.2, 1079.4, 1262.4, 1477.7,
                    1728, 2021.4, 2366, 2769.7, 3240.7, 3792.5, 4438.5, 5192.2, 6077.7, 7114,
                    8322.6, 9738.4, 11396.4, 13337.1, 15608.9, 18265.5, 21374.4];

var qFactors = [5, 6, 7, 5.5, 9.5, 5.5, 6.5, 6.1, 7.1, 5.9, 6.9, 5.7, 6.7, 6.5,
                6.1, 6.7, 6.3, 6.4, 6.4, 6.5, 6.3, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4,
                6.3, 6.4, 6.4, 6.3, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4];

var freqBins = [8, 10, 12, 14, 17, 19, 23, 27, 32, 37, 44, 51, 61, 71, 83, 98, 114,
                134, 157, 184, 215, 252, 295, 345, 404, 473, 554, 648, 759, 888,
                1039, 1217, 1424, 1666, 1950, 2282, 2671, 3126, 3658, 4095];

var lowShelfFreq = 48.5;
var highShelfFreq = 23051.3;

function AudioSource(buffer) {
    var playing = false;
    var audioSource = this;
    var startTime;

    this.freqBins = freqBins;
    this.bufferSource = audioContext.createBufferSource();
    this.analyser = audioContext.createAnalyser();
    this.gainNode = audioContext.createGain();
    this.bufferSource.connect(this.gainNode);

    this.eqNodes = [];

    var lowshelf = audioContext.createBiquadFilter();
    lowshelf.type = 'lowshelf'; // surprise!
    lowshelf.frequency.value = lowShelfFreq;
    this.eqNodes.push(lowshelf);
    this.gainNode.connect(lowshelf);

    var chainLink = lowshelf;
    for (var f = 0; f < centerFreqs.length; f++) {
        var eq = audioContext.createBiquadFilter();
        eq.type = 'peaking';
        eq.frequency.value = centerFreqs[f];
        eq.Q.value = qFactors[f];
        this.eqNodes.push(eq);
        chainLink.connect(eq);
        chainLink = eq;
    }

    var highshelf = audioContext.createBiquadFilter();
    highshelf.type = 'highshelf';
    highshelf.frequency.value = highShelfFreq;
    this.eqNodes.push(highshelf);
    chainLink.connect(highshelf);

    highshelf.connect(this.analyser);
    this.analyser.connect(audioContext.destination);
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0;
    this.analyser.maxDecibels = -10;
    this.bufferSource.buffer = buffer;

    this.bufferSource.onended = function() {
        audioSource.end();
    };

    this.isPlaying = function() {
        return playing;
    };

    this.getDuration = function() {
        return this.bufferSource.buffer.duration;
    };

    this.getStartTime = function() {
        return startTime;
    };

    this.setGain = function(gain) {
        this.gainNode.gain.value = Math.min(Math.max(0, gain), 1);
    };

    this.resetEQ = function() {
        this.eqNodes.forEach(function(eq) {
            eq.gain.value = 0;
        });
    };

    this.play = function(buffer) {
        this.setGain(globalVolume);
        this.bufferSource.start(0);
        startTime = Date.now();
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
        d3.select('#currentTime').text("--:--");
    };

    this.end = function() {
        playing = false;
        var arr = new Uint8Array(this.analyser.frequencyBinCount);
        draw(arr, true);
    };
}

function secondsFormat(seconds) {
    return Math.floor(seconds / 60) + ":" + d3.format("02d")(Math.floor(seconds % 60));
}

input.on('change', function () {
    var fr = new FileReader();
    fr.onload = function (e) {
        audioContext.decodeAudioData(e.target.result, function (buffer) {

            // Get metadata and fill in the divs
            parse_audio_metadata(input.node().files[0], function(data) {
                d3.select('#title').text(data.title);
                d3.select('#artist').text(data.artist);
                d3.select('#album').text(data.album);
            });
            d3.selectAll('#time, #currentTime, #totalTime').style('display', 'inline');
            d3.select('#totalTime').text(secondsFormat(buffer.duration));

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
            <svg width={this.props.width}
                height={this.props.height}>{this.props.children}</svg>
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
            <rect className={"bar"}
                fill={this.props.fill}
                width={this.props.width}
                height={this.props.height}
                x={this.props.x}
                y={this.props.chartHeight - this.props.height} />
        );
    }
});

var EqualizerBar = React.createClass({
    getInitialState: function() {
        var yScale = d3.scale.linear()
            .domain([-20, 20])
            .range([this.props.height, 0]);

        return {yScale: yScale};
    },

    setFilter: function(e) {
        this.props.eq.gain.value =
            this.state.yScale.invert(e.pageY - this.props.height / 150 -
                d3.select('#visualizer').node().getBoundingClientRect().top);
    },

    mouseDown: function(e) {
        mouseIsDown = true;
        this.setFilter(e);
    },

    mouseMove: function(e) {
        if (mouseIsDown && !clickingVolume) {
            this.setFilter(e);
        }
    },

    mouseUp: function(e) {
        mouseIsDown = false;
    },

    render: function() {

        return (<g>
                    <rect className={"equalizerRect"}
                        fill={this.props.fill}
                        width={this.props.width}
                        height={this.props.height / 75}
                        x={this.props.x}
                        y={this.state.yScale(this.props.eq.gain.value)} />
                    <rect className={"equalizerClick"} onMouseDown={this.mouseDown}
                        onMouseMove={this.mouseMove} onMouseUp={this.mouseUp}
                        fill={"none"}
                        width={this.props.width}
                        height={this.props.height}
                        x={this.props.x}
                        y={this.props.chartHeight - this.props.height} />
                </g>);
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

        var bars = this.props.data.map(function(d, i) {
            return (
                <g key={i}>
                    <Bar height={yScale(d)} width={xScale.rangeBand()} x={xScale(i)}
                    chartHeight={props.height} fill={colourScale(d)} />
                    <EqualizerBar height={props.height} width={xScale.rangeBand()} x={xScale(i)}
                    chartHeight={props.height} fill={props.eqColour} eq={currentSource.eqNodes[i]} />
                </g>
            );
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
                    highColour={this.props.highColour} lowColour={this.props.lowColour}
                    eqColour={this.props.eqColour} />
            </Chart>
        );
    }
});

function draw(freqArray, isEnding) {
    ReactDOM.render(
        <Visualizer data={freqArray} width={d3.select('body').node().getBoundingClientRect().width}
            height={d3.select('body').node().getBoundingClientRect().height -
                    d3.select('#topPanel').node().getBoundingClientRect().height}
            highColour={highColour} lowColour={lowColour} eqColour={eqColour} />,
        document.getElementById('visualizer')
    );

    renderVolume();

    d3.select('#currentTime').text(isEnding ? "--:--" :
                                secondsFormat((Date.now() - currentSource.getStartTime()) / 1000));
}
