//webgl2_gpgpu_evaluator.js
'use strict';
window.addEventListener('load', () => {
    if(window.navigator.userAgent.toLowerCase().indexOf('chrome') == -1){
	alert('Currently Only Chrome Browser can allow GLSL3.0(WebGL2)');
    }

    window.glCanvas = document.getElementById("webgl_canvas");
    window.glCanvas.width = 640;
    window.glCanvas.height = 480;
    window.glCanvas.setAttribute("style", "display: none");
    
    const gl2 = window.glCanvas.getContext("webgl2");

    let vsScriptText = "#version 300 es \n out float result; in vec3 vertexPositions; void main(void){result = vertexPositions[0] + vertexPositions[1] + vertexPositions[2];}";
    window.vertexShader = gl2.createShader(gl2.VERTEX_SHADER);
    gl2.shaderSource(window.vertexShader, vsScriptText);
    gl2.compileShader(window.vertexShader);


    let fsScriptText = "#version 300 es \n void main(void){}";
    window.fragmentShader = gl2.createShader(gl2.FRAGMENT_SHADER);
    gl2.shaderSource(window.fragmentShader, fsScriptText);
    gl2.compileShader(window.fragmentShader);

    window.program = gl2.createProgram();
    gl2.attachShader(window.program, window.vertexShader);
    gl2.attachShader(window.program, window.fragmentShader);

    // TransformFeedbackの登録
    gl2.transformFeedbackVaryings(window.program, ["result"], gl2.SEPARATE_ATTRIBS);

    // シェーダのリンク
    gl2.linkProgram(window.program);
    gl2.useProgram(window.program);

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
    let vertexTransformFeedback = gl2.createBuffer();
    let transformFeedback = gl2.createTransformFeedback();

    gl2.bindBuffer(gl2.ARRAY_BUFFER, vertexTransformFeedback);
    gl2.bufferData(gl2.ARRAY_BUFFER, numOfPoint * Float32Array.BYTES_PER_ELEMENT, gl2.DYNAMIC_COPY);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, null);

    gl2.bindTransformFeedback(gl2.TRANSFORM_FEEDBACK, transformFeedback);
    gl2.bindBufferBase(gl2.TRANSFORM_FEEDBACK_BUFFER, 0, vertexTransformFeedback);

    gl2.beginTransformFeedback(gl2.POINTS);

    // シェーダの実行
    gl2.drawArrays(gl2.POINTS, 0, numOfPoint);
    gl2.endTransformFeedback();

    let arrBuffer = new ArrayBuffer(numOfPoint * Float32Array.BYTES_PER_ELEMENT);
    arrBuffer = new Float32Array(arrBuffer);
    gl2.getBufferSubData(gl2.TRANSFORM_FEEDBACK_BUFFER, 0, arrBuffer);

    document.getElementById('result_display').innerHTML = arrBuffer[0] + "," + arrBuffer[1] + "," + arrBuffer[2];
});
