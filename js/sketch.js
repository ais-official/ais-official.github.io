let song;
let audioCtx;
let gainNode;
let source;
let fft;
let playBtn;
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
    
    song.elt.oncanplaythrough = () => {
        // 音源をWeb Audio APIのグラフに接続
        if (!source) {
            source = audioCtx.createMediaElementSource(song.elt);
            source.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            fft.setInput(gainNode); // FFTをこのルートに繋ぐ
            playBtn.removeAttribute('disabled');
            playBtn.elt.textContent = '▶';
        }
    };

    playBtn.mousePressed(togglePlay);
    background(18, 18, 18);
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
	background(18, 18, 18, 30);
	fft.analyze();
	translate(width / 2, height / 2);
	drawFlower();
}

/* 花全体の配置と描画 */
function drawFlower() {
	let numPetals = 5;
	noFill();
	stroke(255, 255, 255, 255);
	for (let i = 0; i < numPetals; i++) {
		push();
		rotate(TWO_PI / numPetals * i);
		// 各パーツの描画
		drawPetal(getPetalSize('kick'));
		drawPetal(getPetalSize('vocal1'));
		drawPetal(getPetalSize('vocal2'));
		drawPetal(getPetalSize('vocal3'));
		pop();
	}
}

/* 花びら1枚の形状定義（不変） */
function drawPetal(size) {
	beginShape();
	vertex(0, 0);
	bezierVertex(-size * 0.2, -size * 0.3, -size * 0.4, -size * 0.7, 0, -size);
	bezierVertex(size * 0.4, -size * 0.7, size * 0.2, -size * 0.3, 0, 0);
	endShape();
}

const baseSize = 128;

const petalMap = {
	kick: {
		hertz: [10, 15],
		gain: [0, 255],
		move: [0, 128]
	},
	vocal1: {
		hertz: [2000, 3000],
		gain: [0, 255],
		move: [128, 200]
	},
	vocal2: {
		hertz: [3000, 5000],
		gain: [0, 255],
		move: [128, 200]
	},
	vocal3: {
		hertz: [5000, 10000],
		gain: [0, 255],
		move: [128, 200]
	}
};

/* 花びらサイズの制御 */
function getPetalSize(type) {
	let isPlaying = !song.elt.paused;
	if (!isPlaying) return getBreathSize(baseSize);
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
		return lerp(1.0, 1.1, 0.5 - 0.5 * cos(PI * t));
	} else {
		let t = (phase - 0.4) / 0.6;
		return lerp(1.1, 1.0, 0.5 - 0.5 * cos(PI * t));
	}
}

/* 音楽によるサイズ */
function getAudioSize(type) {
	let val = getAudio(type);
	let config = petalMap[type];
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
	let config = petalMap[type];
	if (!config) return 0;
	return fft.getEnergy(
		config.hertz[0],
		config.hertz[1]
	);
}