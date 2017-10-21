# WebGL2_GPGPU

## Source Code
### webgl2_gpgpu_evaluator
 webgl2_gpgpu_evaluator.html and webgl2_gpgpu_evaluator.js is a basic example code using TransformFeedback function to get result from Vertex Shader. 

 webgl2_gpgpu_evaluator.html は，TransformFeedback機能を用いて，頂点シェーダの計算結果をメインプログラムに返す部分のサンプルです．頂点シェーダに渡せる値は頂点座標や色などのAttribute扱いのメモリです．

### webgl2_gpgpu_vtf
 webgl2_gpgpu_vtf.html and webgl2_gpgpu_vtf.js is a example to give more large memories to Vertex Shader with a technique called "Vertex Texture Fetch"(VTF). Using VTF, we used texture memories as uniform array. But it's restricted as Unsingend Char.
