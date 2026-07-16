let song;
let audioCtx;
let gainNode;
let source;
let fft;
let playBtn;
let volumeSlider;
let isFading = false;
let flowerLayer;
let energyHistory = [];
let particles = [];
let prevEnergy = 0;
let flowerHistory = [];
let splitter, analyserL, analyserR;
const CANVAS_MAX_SIZE = 400;

/*音楽ファイル読み込み（事前に読み込み）*/
function preload() {
	//song = loadSound('/audio/tokyo.m4a');
}

/*キャンバスの作成、HTMLの箱への配置、ボタンの連動など、動かすための準備を行う。*/
function setup() {
    let container = document.getElementById('p5-canvas');
	let w = container.clientWidth;
	let canvas = createCanvas(w, w);
	canvas.parent('p5-canvas');

    fft = new p5.FFT();
	/* 再生ボタンの動的生成 */
   	playBtn = createButton('play_arrow');
    playBtn.parent('p5-canvas');
    playBtn.id('play-btn');
    playBtn.style('visibility', 'hidden');

	/* createSlider(最小値, 最大値, 初期値, ステップ) */
    volumeSlider = createSlider(0.1, 1.0, 0.1, 0.01);
    volumeSlider.parent('p5-canvas'); // canvasの下部に配置
    volumeSlider.addClass('volume-ctrl'); // CSSのスタイルを適用
    volumeSlider.hide();

	// 1. AudioContextの作成（Web Audio APIの入り口）
    audioCtx = getAudioContext();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0; // 最初は無音

    // 2. 音源の作成と接続
    song = createAudio('/audio/tokyo.m4a');
    song.elt.load();

	song.elt.onended = () => {
        playBtn.html("play_arrow");
        volumeSlider.hide(); // 曲が終わったら隠す
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

            playBtn.style('visibility', 'visible');
            playBtn.html("play_arrow");
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

/*音楽が鳴っていれば一時停止し、止まっていれば再生する。同時にボタンを切り替える。*/
function togglePlay() {
    userStartAudio().then(() => {

		let targetVolume = volumeSlider.value(); // ★ 現在のスライダーの値を取得
		isFading = true;
        if (song.elt.paused) {
			volumeSlider.show();
            // フェードインのスケジュール
            let now = audioCtx.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(targetVolume, now + 3); // 2秒でフェードイン
			setTimeout(() => {
				isFading = false;
			}, 3000);

            song.play();
            playBtn.html("pause");
        } else {
			volumeSlider.hide();
            // フェードアウトのスケジュール
            let now = audioCtx.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.5); // 0.5秒でフェードアウト
			setTimeout(() => {
				song.pause();
				isFading = false;
			}, 500);
            
            setTimeout(() => song.pause(), 500);
            playBtn.html("play_arrow");
        }
    });
}

/* ブラウザが再びアクティブになったことを検知する関数 */
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState !== "visible") {
		song.pause();
		song.elt.currentTime = 0;
		song.elt.load();
		playBtn.html("play_arrow");
        volumeSlider.hide();
	}
});

/* 毎フレームの制御（全体構成） */
function draw() {
	/* ユーザーがスライダーを動かした時に即座に音量へ反映させる処理（再生中のみ） */
    if (audioCtx && gainNode && !song.elt.paused && !isFading) {
		let now = audioCtx.currentTime;
		gainNode.gain.linearRampToValueAtTime(volumeSlider.value(), now + 0.05);
	}

	background(18, 18, 18, 255);
	fft.analyze();

	/* 花レイヤーを少しずつ消して残像を作る */
	flowerLayer.clear();

	let scaleFactor = width / 400;

	// 現在の花の状態を保存
	flowerHistory.push({
		kick: getPetalSize('kick'),
		vocal1: getPetalSize('vocal1'),
		vocal2: getPetalSize('vocal2'),
		vocal3: getPetalSize('vocal3'),
		breath: getBreath()
	});

	// 残像数
	if (flowerHistory.length > 7) {
		flowerHistory.shift();
	}

	// 古いものから描画
	for (let i = 0; i < flowerHistory.length; i++) {
		let f = flowerHistory[i];
		let alpha = (flowerHistory.length === 1) ? 255 : map(i, 0, flowerHistory.length - 1, 15, 255);

		flowerLayer.push();
        flowerLayer.translate(width / 2, height / 2);
        drawFlower(flowerLayer, scaleFactor, f, alpha);
        flowerLayer.pop();
	}

	image(flowerLayer, 0, 0);
	/* パーティクル */
	updateParticles();
	/* ビジュアライザー */
	drawVisualizer();
	
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
        let minHeight = song.elt.paused ? 0 : 8;

        // 左
        let hL = map(fullDataL[idx], 0, 255, minHeight, maxHeight) * weight;
        let xL = centerX - gap / 2 - (i + 1) * barWidth - (i * gap);
        for (let y = 0; y < hL; y += 2) {
            let t = y / hL;
            let alpha = lerp(200, 26, t * t * t);
            fill(200, 200, 200, alpha);
            rect(xL, height - y, barWidth, 1);
        }

        // 右
        let hR = map(fullDataR[idx], 0, 255, minHeight, maxHeight) * weight;
        let xR = centerX + gap / 2 + (i * barWidth) + (i * gap);
        for (let y = 0; y < hR; y += 2) {
            let t = y / hR;
            let alpha = lerp(200, 26, t * t * t);
            fill(200, 200, 200, alpha);
            rect(xR, height - y, barWidth, 1);
        }
    }
}

/* 花全体の配置と描画 */
function drawFlower(g, scaleFactor, state, alpha) {
    g.noFill();
	g.stroke(255, alpha);

	for (let i = 0; i < 5; i++) {
		g.push();
		g.rotate(TWO_PI / 5 * i);

		drawPetal(g, state.kick * scaleFactor, state.breath);
		drawPetal(g, state.vocal1 * scaleFactor, state.breath);
		drawPetal(g, state.vocal2 * scaleFactor, state.breath);
		drawPetal(g, state.vocal3 * scaleFactor, state.breath);

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
		move: [0, 132]
	},
	vocal1: {
		hertz: [500, 1000],
		gain: [0, 255],
		move: [132, 200]
	},
	vocal2: {
		hertz: [1000, 3000],
		gain: [0, 255],
		move: [132, 200]
	},
	vocal3: {
		hertz: [3000, 10000],
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