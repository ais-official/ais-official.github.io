let song;
let fft;
let playBtn;

/*音楽ファイル（mp3）を事前に読み込む。*/
function preload() {
  //song = loadSound('./audio/tokyo.mp3');
}

/*キャンバスの作成、HTMLの箱への配置、ボタンの連動など、動かすための準備を行う。*/
function setup() {
  // 400x400のキャンバスを作ります
  let w = min(windowWidth * 0.9, 400);
  let canvas = createCanvas(w, w); // 正方形で生成

  /*HTMLの id="p5-canvas" の箱の中にキャンバスを入れます*/
  canvas.parent('p5-canvas');

  // 【以前の状態を維持】読み込み処理
  song = loadSound('./audio/tokyo.m4a', () => {
    song.onended(resetButton);
  });

  fft = new p5.FFT();
  playBtn = select('#play-btn');
  playBtn.mousePressed(togglePlay);

  noLoop(); // 停止状態で待機
  background(20, 20, 20); // 初回背景
}

/*画面を真っ黒に塗りつぶし、音の大きさを計算して、5枚の花びらを描画する。*/
function draw() {
    background(20, 20, 20, 30);
    fft.analyze();
    
    let kick   = fft.getEnergy(10, 15); 
    let bass   = fft.getEnergy(150, 400);
    let vocal    = fft.getEnergy(2000, 4000);
    let treble = fft.getEnergy(8000, 12000);
  
    translate(width / 2, height / 2);
  
    noFill();
    let numPetals = 5;
    let isPlaying = song.isPlaying(); // 音楽が停止しているかチェック

	// 呼吸の計算（1サイクルが約5秒）
	let speed = frameCount * 0.01;
	let phase = (speed / TWO_PI) % 1; // 0～1の周期
	let breath;
	if (phase < 0.4) {
		// 吸う（短く）
		let t = phase / 0.4;
		breath = lerp(1.0, 1.1, 0.5 - 0.5 * cos(PI * t));
	} else {
		// 吐く（長く）
		let t = (phase - 0.4) / 0.6;
		breath = lerp(1.1, 1.0, 0.5 - 0.5 * cos(PI * t));
	}
    
    for (let i = 0; i < numPetals; i++) {
        push();
        let angle = TWO_PI / numPetals * i;
        rotate(angle);

        strokeWeight(1);
		/*色*/
        stroke(255, 0, 128, 255);

        let baseSize = 80;
		let sK = isPlaying ? map(kick, 0, 180, 0, 80) : baseSize * breath;
        let sB = isPlaying ? map(bass, 0, 255, 80, 130) : baseSize * breath;
        let sV = isPlaying ? map(vocal, 0, 255, 0, 190) : baseSize * breath;
        let sT = isPlaying ? map(treble, 0, 255, 80, 180) : baseSize * breath;

        drawPetal(sK);
        drawPetal(sB);
        drawPetal(sV);
        drawPetal(sT);
      
        pop();
    }
  
    //fill(255, 255, 255, isPlaying ? map(treble, 0, 255, 150, 255) : 255);
    //noStroke();
    //let coreSize = isPlaying ? map(treble, 0, 255, 10, 25) : 15;
    //ellipse(0, 0, coreSize, coreSize);
}


/* 根元が細く、先端が丸い形状を描画する関数 */
function drawPetal(size) {
	beginShape();
	// 根元から先端の丸みに向かって、外側の輪郭をベジェで描画
	vertex(0, 0); // 根元
	bezierVertex(-size * 0.2, -size * 0.3, -size * 0.4, -size * 0.7, 0, -size); // 左側の膨らみと先端
	bezierVertex(size * 0.4, -size * 0.7, size * 0.2, -size * 0.3, 0, 0); // 右側の膨らみと戻り
	endShape();
  }

// 音楽終了時に呼び出される関数
function resetButton() {
	noLoop();
	playBtn.html('▶');
  }

/*音楽が鳴っていれば一時停止し、止まっていれば再生する。同時にボタンを切り替える。*/
function togglePlay() {
	// 「ブラウザの許可が出てから」再生処理を動かす
	userStartAudio().then(() => {
	  if (song.isPlaying()) {
		song.pause();
		noLoop(); 
		playBtn.html('▶');
	  } else {
		song.play();
		loop(); 
		playBtn.html('■');
	  }
	});
  }

  // ブラウザが「画面が戻ってきた」ことを検知する関数
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // 画面が戻った瞬間、オーディオが止まっていたらボタンを「▶」に戻す
    if (!song.isPlaying()) {
      noLoop();
      playBtn.html('▶');
    }
  }
});