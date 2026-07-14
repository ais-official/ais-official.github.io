let song;
let audioCtx;
let gainNode;
let source;
let fft;
let playBtn;
let flowerLayer;
let energyHistory = [];
let particles = [];
let prevEnergy = 0;
let splitter, analyserL, analyserR;
const CANVAS_MAX_SIZE = 400;

/*音楽ファイル読み込み（事前に読み込み）*/
function preload() {
	//song = loadSound('./audio/tokyo.m4a');
}

/*キャンバスの作成、HTMLの箱への配置、ボタンの連動など、動かすための準備を行う。*/
function setup() {
    let container = document.getElementById('p5-canvas');
	let w = container.clientWidth;
	let canvas = createCanvas(w, w);
	canvas.parent('p5-canvas');

    fft = new p5.FFT();
    playBtn = select('#play-btn');

	// 1. AudioContextの作成（Web Audio APIの入り口）
    audioCtx = getAudioContext();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0; // 最初は無音

    // 2. 音源の作成と接続
    song = createAudio('./audio/tokyo.m4a');
    song.elt.load();

	song.elt.onended = () => {
		resetButton();
	};
    
    song.elt.oncanplaythrough = () => {
        // 音源をWeb Audio APIのグラフに接続
        if (!source) {
            source = audioCtx.createMediaElementSource(song.elt);

			/* analyser */
			splitter = audioCtx.createChannelSplitter(2);
			source.connect(splitter);
			analyserL = audioCtx.createAnalyser();
			analyserR = audioCtx.createAnalyser();
			splitter.connect(analyserL, 0); // L
			splitter.connect(analyserR, 1); // R

			/* flower */
            source.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            fft.setInput(gainNode); // FFTをこのルートに繋ぐ
            playBtn.removeAttribute('disabled');
            playBtn.elt.textContent = '▶';
        }
    };

    playBtn.mousePressed(togglePlay);
    background(18, 18, 18);
	flowerLayer = createGraphics(width, height);
}

function windowResized() {
    let container = document.getElementById('p5-canvas');
    let w = container.clientWidth;
    resizeCanvas(w, w);
	flowerLayer = createGraphics(width, height);
}

// 音楽終了時に呼び出される関数
function resetButton() {
	playBtn.html('▶');
}

/*音楽が鳴っていれば一時停止し、止まっていれば再生する。同時にボタンを切り替える。*/
function togglePlay() {
    userStartAudio().then(() => {
        if (song.elt.paused) {
            // フェードインのスケジュール
            let now = audioCtx.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(1, now + 3); // 2秒でフェードイン

            song.play();
            playBtn.html('■');
        } else {
            // フェードアウトのスケジュール
            let now = audioCtx.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.5); // 0.5秒でフェードアウト
            
            setTimeout(() => song.pause(), 500);
            playBtn.html('▶');
        }
    });
}

// ブラウザが「画面が戻ってきた」ことを検知する関数
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState !== "visible") {
		song.pause();
		song.elt.currentTime = 0;
		song.elt.load();
		playBtn.html('▶');
	}
});

/* 毎フレームの制御（全体構成） */
function draw() {
	background(18, 18, 18, 255);
	fft.analyze();

	// 花レイヤーを少しずつ消して残像を作る
	flowerLayer.background(18, 18, 18, 50);

	flowerLayer.push();
	flowerLayer.translate(width / 2, height / 2);
	let scaleFactor = width / 400;
	drawFlower(flowerLayer, scaleFactor);
	flowerLayer.pop();

	image(flowerLayer, 0, 0);
	drawVisualizer();
	updateParticles();
}

function drawVisualizer() {
    if (!analyserL || !analyserR) return;

    let fullDataL = new Uint8Array(analyserL.frequencyBinCount);
    let fullDataR = new Uint8Array(analyserR.frequencyBinCount);
    analyserL.getByteFrequencyData(fullDataL);
    analyserR.getByteFrequencyData(fullDataR);

    let centerX = width / 2;
    let barWidth = 6;
    let gap = 2;
	let binCount = floor((centerX - gap / 2) / (barWidth + gap));
    let maxHeight = height * 0.25;
    const MAXHERTZ = 16000;
    let maxIndex = floor(fullDataL.length * MAXHERTZ / (audioCtx.sampleRate / 2));
	

    noStroke();

    for (let i = 0; i < binCount; i++) {
        let idx = floor(i * maxIndex / (binCount - 1));
        // 中央ほど高く、外側ほど低くする重み
        let weight = map(i, 0, binCount - 1, 1.0, 0.30);
        // 再生中だけ最低高さを保証
        let minHeight = song.elt.paused ? 0 : 6;

        // 左
        let hL = map(fullDataL[idx], 0, 255, minHeight, maxHeight) * weight;
        let xL = centerX - gap / 2 - (i + 1) * barWidth - (i * gap);
        for (let y = 0; y < hL; y += 2) {
            let t = y / hL;
            let alpha = lerp(255, 26, t * t * t);
            fill(255, 255, 255, alpha);
            rect(xL, height - y, barWidth, 1);
        }

        // 右
        let hR = map(fullDataR[idx], 0, 255, minHeight, maxHeight) * weight;
        let xR = centerX + gap / 2 + (i * barWidth) + (i * gap);
        for (let y = 0; y < hR; y += 2) {
            let t = y / hR;
            let alpha = lerp(255, 26, t * t * t);
            fill(255, 255, 255, alpha);
            rect(xR, height - y, barWidth, 1);
        }
    }
}

/* 花全体の配置と描画 */
function drawFlower(g, scaleFactor) {
    let numPetals = 5;
    g.noFill();
    g.stroke(255, 255, 255, 255);

    for (let i = 0; i < numPetals; i++) {
        g.push();
        g.rotate(TWO_PI / numPetals * i);

        drawPetal(g, getPetalSize('kick') * scaleFactor, getBreath());
		drawPetal(g, getPetalSize('vocal1') * scaleFactor, getBreath());
		drawPetal(g, getPetalSize('vocal2') * scaleFactor, getBreath());
		drawPetal(g, getPetalSize('vocal3') * scaleFactor, getBreath());

        g.pop();
    }
}

/* 花びら1枚の形状定義（不変） */
function drawPetal(g, size, breath) {
	let width = lerp(1.0, 0.65 / 0.6, (breath - 1.0) / 0.1);

	g.beginShape();
	g.vertex(0, 0);
	g.bezierVertex(
		-size * 0.2 * width,
		-size * 0.3,
		-size * 0.6 * width,
		-size * 0.7,
		0,
		-size
	);
	g.bezierVertex(
		size * 0.6 * width,
		-size * 0.7,
		size * 0.2 * width,
		-size * 0.3,
		0,
		0
	);
	g.endShape();
}

const BASESIZE = 128;

const PETALMAP = {
	kick: {
		hertz: [10, 15],
		gain: [0, 255],
		move: [0, 70]
	},
	vocal1: {
		hertz: [2000, 3000],
		gain: [0, 255],
		move: [132, 200]
	},
	vocal2: {
		hertz: [3000, 5000],
		gain: [0, 255],
		move: [132, 200]
	},
	vocal3: {
		hertz: [5000, 10000],
		gain: [0, 255],
		move: [132, 200]
	}
};

/* 花びらサイズの制御 */
function getPetalSize(type) {
	let isPlaying = !song.elt.paused;
	if (!isPlaying) return getBreathSize(BASESIZE);
	return getAudioSize(type);
}

/* 音楽停止中の呼吸サイズ */
function getBreathSize(size) {
	return size * getBreath();
}

/* 呼吸値の計算 */
function getBreath() {
	let speed = frameCount * 0.01;
	let phase = (speed / TWO_PI) % 1;
	if (phase < 0.4) {
		let t = phase / 0.4;
		return lerp(0.97, 1.03, 0.5 - 0.5 * cos(PI * t));
	} else {
		let t = (phase - 0.4) / 0.6;
		return lerp(1.03, 0.97, 0.5 - 0.5 * cos(PI * t));
	}
}

/* 音楽によるサイズ */
function getAudioSize(type) {
	let val = getAudio(type);
	let config = PETALMAP[type];
	return map(
		val,
		config.gain[0],
		config.gain[1],
		config.move[0],
		config.move[1]
	);
}

/* 音量値 */
function getAudio(type) {
	let config = PETALMAP[type];
	if (!config) return 0;
	return fft.getEnergy(
		config.hertz[0],
		config.hertz[1]
	);
}

function updateParticles() {
	let energy = fft.getEnergy(11000, 16000);
	// 約1秒分の平均を取る（60fps想定）
	energyHistory.push(energy);
	if (energyHistory.length > 60) {
		energyHistory.shift();
	}
	let avgEnergy = 0;
	for (let e of energyHistory) {
		avgEnergy += e;
	}
	avgEnergy /= energyHistory.length;
	//textSize(20);
	//fill(255);
	//text(nf(avgEnergy, 1, 1), 20, 30);
	// 平均音量が一定以上なら発生
	if (!song.elt.paused && avgEnergy > 90) {
		for (let i = 0; i < 2; i++) {
			particles.push({
				x: width / 2,
				y: height / 2,
				angle: random(TWO_PI),
				speed: random(1, 3),
				size: random(5, 10),
				life: 255
			});
		}
	}

	noStroke();

	for (let i = particles.length - 1; i >= 0; i--) {
		let p = particles[i];
		p.x += cos(p.angle) * p.speed;
		p.y += sin(p.angle) * p.speed;
		p.speed *= 0.98;
		p.life -= 5;
		fill(255, p.life);
		circle(p.x, p.y, p.size);
		if (p.life <= 0) {
			particles.splice(i, 1);
		}
	}
}