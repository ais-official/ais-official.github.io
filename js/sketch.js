let song;
let fft;
let playBtn;

/*音楽ファイル読み込み（事前に読み込み）*/
function preload() {
	//song = loadSound('./audio/tokyo.m4a');
}

/*キャンバスの作成、HTMLの箱への配置、ボタンの連動など、動かすための準備を行う。*/
function setup() {
    let w = min(windowWidth * 0.9, 400);
    let canvas = createCanvas(w, w);
    canvas.parent('p5-canvas');

    // FFTはここで先に初期化する
    fft = new p5.FFT();
    
    playBtn = select('#play-btn');

    song = createAudio('./audio/tokyo.m4a', () => {
        // ここでは接続のみを行う
        fft.setInput(song);
        song.onended(resetButton);
        playBtn.removeAttribute('disabled');
        playBtn.html('▶');
    });

    playBtn.mousePressed(togglePlay);
    background(18, 18, 18);
}

/*音楽が鳴っていれば一時停止し、止まっていれば再生する。同時にボタンを切り替える。*/
function togglePlay() {
	userStartAudio().then(() => {
		if (song.elt.paused) {
			song.play();
			playBtn.html('■');
		} else {
			song.pause();
			playBtn.html('▶');
		}
	});
}

// 音楽終了時に呼び出される関数
function resetButton() {
	playBtn.html('▶');
}

// ブラウザが「画面が戻ってきた」ことを検知する関数
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") {
		setTimeout(() => {
			if (!song.isPlaying()) {
				playBtn.html('▶');
			}
		}, 100);
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

	let baseSize = 80;
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
	let minMap = (type === 'kick') ? 0 : 90;
	let maxMap = (type === 'kick') ? 80 : 190;
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