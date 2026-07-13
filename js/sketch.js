let song;
let fft;
let playBtn;
const CANVAS_MAX_SIZE = 400;

/*音楽ファイル読み込み（事前に読み込み）*/
function preload() {
	//song = loadSound('./audio/tokyo.m4a');
}

/*キャンバスの作成、HTMLの箱への配置、ボタンの連動など、動かすための準備を行う。*/
function setup() {
    let w = min(windowWidth * 0.9, CANVAS_MAX_SIZE);
    let canvas = createCanvas(w, w);
    canvas.parent('p5-canvas');

    fft = new p5.FFT();

    playBtn = select('#play-btn');

	song = createAudio('./audio/tokyo.m4a');
	song.elt.load();
	song.elt.addEventListener('canplay', () => {
		fft.setInput(song);
		song.elt.onended = resetButton;
		playBtn.removeAttribute('disabled');
		playBtn.elt.textContent = '▶';
	});

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
			const FADE_IN_TIME = 2000; // フェードイン時間(ms)
			const FADE_INTERVAL = 40; // 音量更新間隔(ms)
			const FADE_STEP = 1 / (FADE_IN_TIME / FADE_INTERVAL);

			song.elt.volume = 0;
			song.play();
		
			let fadeIn = setInterval(() => {
				if (song.elt.volume < 1) {
					song.elt.volume = Math.min(song.elt.volume + FADE_STEP, 1);
				} else {
					clearInterval(fadeIn);
				}
			}, FADE_INTERVAL);
		
			playBtn.html('■');
		} else {
			song.pause();
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
	// 全体の流れを記述
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
		drawPetal(getPetalSize('bass'));
		drawPetal(getPetalSize('vocal'));
		drawPetal(getPetalSize('treble'));
		
		pop();
	}
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
  
/* 音量や呼吸からサイズを決定 */
function getPetalSize(type) {
	let isPlaying = !song.elt.paused;

	let baseSize = 128;
	if (!isPlaying) return baseSize * getBreath();
	let val;
	switch(type) {
		case 'kick':   val = fft.getEnergy(10, 15);   break;
		case 'bass':   val = fft.getEnergy(2000, 3000); break;
		case 'vocal':  val = fft.getEnergy(3000, 5000); break;
		case 'treble': val = fft.getEnergy(5000, 10000); break;
		default: return baseSize;
	}
	// マッピングの範囲調整
	let minMap = (type === 'kick') ? 0 : 128;
	let maxMap = (type === 'kick') ? 128 : 180;
	return map(val, 0, 255, minMap, maxMap);
}
  
/* 花びら1枚の形状定義（不変） */
function drawPetal(size) {
	beginShape();
	vertex(0, 0);
	bezierVertex(-size * 0.2, -size * 0.3, -size * 0.4, -size * 0.7, 0, -size);
	bezierVertex(size * 0.4, -size * 0.7, size * 0.2, -size * 0.3, 0, 0);
	endShape();
}