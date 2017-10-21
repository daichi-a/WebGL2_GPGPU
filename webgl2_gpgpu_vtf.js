//webgl2_gpgpu_vtf.js
'use strict';
window.addEventListener('load', () => {
    // 参考にした: 
    // https://qiita.com/edo_m18/items/3258afe3a1d8ce2c6cd9
    

    if(window.navigator.userAgent.toLowerCase().indexOf('chrome') == -1){
	alert('Currently Only Chrome Browser can allow GLSL3.0(WebGL2)');
    }

    window.glCanvas = document.getElementById("webgl_canvas");
    window.glCanvas.width = 640;
    window.glCanvas.height = 480;
    window.glCanvas.setAttribute("style", "display: none");
    
    const gl2 = window.glCanvas.getContext("webgl2");

    // Vertex Texture Fetchが可能かどうかをチェックする
    let info = gl2.getParameter(gl2.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    if(info > 0){
	console.log('max_vertex_texture_imaeg_unit: ', info);
	// この値までテクスチャをVertexシェーダ側で読み込める
    }
    else {
	alert('VTF not supported');
	return;
    }

    let vsScriptText = "#version 300 es \n" + 
	"out float result;" + 
	"in vec3 vertexPositions;" + 
	"uniform sampler2D vtfData;" + 
	"const float pixelSize = 2.0;" + 
	"const float frag = 1.0 / pixelSize;" +
	"const float shiftWidth = frag / pixelSize;" + 
	"const float texPosX = 1.0 * frag + shiftWidth;" + 
	"const float texPosY = (1.0 * frag) * frag + shiftWidth;" + 
	"void main(void){" +
             "vec4 valueFromTexture = texture(vtfData, vec2(texPosX, texPosY)).rgba;" + 
              "result = valueFromTexture[0] + valueFromTexture[1] + valueFromTexture[2] + valueFromTexture[3]" +
	" + vertexPositions[0] + vertexPositions[1] + vertexPositions[2];" + 
	"}";
    // uniform sampler2D vtfData; がテクスチャオブジェクト
    // ほんとに頂点座標オブジェクトならtexelFetch()で読み出せるのだが，
    // GPGPUの場合，頂点座標オブジェクトではないので，古典的な方法を使う

    // const float pixelSize = 2.0; //テクスチャの元々の1辺のサイズ
    // 元画素数は2*2だったが，GLSL内部では1.0*1.0に強制変換されるため，
    // 1.0を1辺のサイズで割って，1ピクセル辺りの幅を出している．ここが座標の最小単位になる
    // const float frag = 1.0 / pixelSize;

    // ただしここから0.5ピクセル分の幅ずらして読み込まなければならない
    // これは，ピクセルの真ん中に読み込みカーソル持ってくるという意味
    // ピクセルの端っこだと隣り合ったピクセルと補間されて
    // 「滲んでしまった色」を読み込む可能性があるため
    // float shiftWidth = frag / pixelSize;

    // float texPosX = 座標 * frag + shiftWidth; 
    // float texPosY = (座標 * frag) * frag + shiftWidth;

    // 読み出す座標を決定
    // vec2 readingPixelPos = vec2(texPosX, texPosY);
    // 値の取り出し
    // vec4 values = texture(vtfData, readingPixelPos).rgba;

    // 頂点座標のattrbuteの方も，シェーダプログラム内部できちんと使ってやらないと，
    // Warningを吐く
    
    window.vertexShader = gl2.createShader(gl2.VERTEX_SHADER);
    gl2.shaderSource(window.vertexShader, vsScriptText);
    gl2.compileShader(window.vertexShader);
    console.log(gl2.getShaderInfoLog(window.vertexShader));

    let fsScriptText = "#version 300 es \n void main(void){}";
    window.fragmentShader = gl2.createShader(gl2.FRAGMENT_SHADER);
    gl2.shaderSource(window.fragmentShader, fsScriptText);
    gl2.compileShader(window.fragmentShader);

    window.program = gl2.createProgram();
    gl2.attachShader(window.program, window.vertexShader);
    gl2.attachShader(window.program, window.fragmentShader);


    // TransformFeedbackを行うVertexシェーダ内の変数の登録登録
    gl2.transformFeedbackVaryings(window.program, ["result"], gl2.SEPARATE_ATTRIBS);
    // シェーダのリンク
    gl2.linkProgram(window.program);
    gl2.useProgram(window.program);

    // Vertex Texture Fetchを用いてVertexシェーダに大量の値を渡す
    // GPU内部へテクスチャオブジェクトを生成する
    let vtfDataTexture = gl2.createTexture();
    // 生成したテクスチャオブジェクトをWebGLにバインドする
    //gl2.activeTexture(gl2.GL_TEXTURE0);
    gl2.bindTexture(gl2.TEXTURE_2D, vtfDataTexture);
    // テクスチャの各種パラメータの設定
    // gl.TEXTURE_MAG(MIN) _FILTERにはgl.NEARESTを用いる
    // これはgl.LINEARを使うと頂点と頂点の間で補間されてしまうので，
    // データの受け渡しには向かないから
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.NEAREST);
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.NEAREST);
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);

    // 渡す値の配列を作る
    // Textureの1辺は2の累乗でRGBAでなければならないので，2*2*4 = 16の1次元配列
    let textureWidth = 2;
    let textureHeight = 2;
    let textureSize = textureWidth * textureHeight * 4;
    let vtfData = new Uint8Array(textureSize);
    for(let i=0; i<textureSize; i++){
        // テクスチャは当然Uint8なのだが，
	// Vertexシェーダ内で取り出される時255で除算されて0.0~1.0で出てくる
	// なので，あらかじめ掛け算をしてfloorしておくなど，0〜255の整数で値を入れておく
	vtfData[i] = Math.random() * 255;
    }
    // テクスチャにデータを設定 テクスチャオブジェクトに指定するのではないことに注意
    gl2.texImage2D(gl2.TEXTURE_2D, //Target
		   0, //Mip map level
		   gl2.RGBA, //テクスチャのピクセルフォーマット
		   textureWidth, textureHeight, // width, height
		   0, //Border
		   gl2.RGBA, //ピクセルの配列形式(RGBAの順で並んでいた)
		   gl2.UNSIGNED_BYTE, //1ピクセルのデータ形式(Uint8)
		   vtfData); //


    // 頂点座標の登録とVBOの生成
    let vertexPosArray = 
	new Array(1.0, 2.0, 3,0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0);
    let numOfPoint = 3; //vec3(x, y, y)で3つ分の配列がある．

    let vboPos = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vboPos);
    gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array(vertexPosArray), gl2.STATIC_DRAW);
    
    let vertexPosAttribLocation = gl2.getAttribLocation(window.program, 'vertexPositions');
    gl2.enableVertexAttribArray(vertexPosAttribLocation);
    let vertexPosAttribStride = 3; //GLSL3.0コードの中でvec3型なので3
    gl2.vertexAttribPointer(vertexPosAttribLocation,
			    vertexPosAttribStride,
			    gl2.FLOAT,
			    false, 0, 0);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, null);
    // 頂点座標の登録とVBOの生成: ここまで


    // TransformFeedbackの指定
    // GPU内へメモリを確保し，登録する
    let vertexTransformFeedback = gl2.createBuffer();
    let transformFeedback = gl2.createTransformFeedback();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vertexTransformFeedback);
    gl2.bufferData(gl2.ARRAY_BUFFER, numOfPoint * Float32Array.BYTES_PER_ELEMENT, gl2.DYNAMIC_COPY);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, null);

    gl2.bindTransformFeedback(gl2.TRANSFORM_FEEDBACK, transformFeedback);
    gl2.bindBufferBase(gl2.TRANSFORM_FEEDBACK_BUFFER, 0, vertexTransformFeedback);

    // シェーダの実行
    gl2.beginTransformFeedback(gl2.POINTS);
    gl2.drawArrays(gl2.POINTS, 0, numOfPoint);
    gl2.endTransformFeedback();

    // TransformFeedbackの結果を取り出す
    let arrBuffer = new ArrayBuffer(numOfPoint * Float32Array.BYTES_PER_ELEMENT);
    arrBuffer = new Float32Array(arrBuffer);
    gl2.getBufferSubData(gl2.TRANSFORM_FEEDBACK_BUFFER, 0, arrBuffer);

    // 結果を表示する
    document.getElementById('result_display').innerHTML = arrBuffer[0] + "," + arrBuffer[1] + "," + arrBuffer[2];
});
