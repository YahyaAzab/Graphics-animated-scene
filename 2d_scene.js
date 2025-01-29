// Vertex and Fragment Shaders
const vertexShaderSrc = `
  attribute vec2 vPosition;
  attribute vec4 aColor;
  uniform float uAspectRatio;
  uniform mat3 uTransformationMatrix;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord; 
  varying vec4 vColor;

  void main() {

      // aspect ratio is to prevent object stretching.
      // transformation matrix for translation, scaling, rotation. 
      // passing texture coordinates and color gradient colors.

      vec3 transformedPosition = uTransformationMatrix * vec3(vPosition, 1.0);
      vec2 scaledPosition = vec2(transformedPosition.x / uAspectRatio, transformedPosition.y);
      gl_Position = vec4(scaledPosition, 0, 1);
      vTexCoord = aTexCoord;
      vColor = aColor;
  }`;

const fragmentShaderSrc = `
  precision mediump float;
  varying vec2 vTexCoord;
  uniform sampler2D uTexture;
  uniform vec4 fColor;
  varying vec4 vColor;
  uniform bool useGradient;
  uniform bool useNightMult;
  uniform vec4 nightMult;

  void main() {

    // determine if it should use the night color multiplier to make it dimmer during night scene.

    if (useNightMult) {
      gl_FragColor = texture2D(uTexture, vTexCoord) * (fColor * nightMult);
    } else {

      // determine if it should use gradient or not. determined by each render function of each shape.

      if (useGradient) {
        gl_FragColor = texture2D(uTexture, vTexCoord) * vColor;
      } else {
        gl_FragColor = texture2D(uTexture, vTexCoord) * fColor;
      }
    }
  }`;

// Global Variables to be able to use them in functions without causing issues
var canvas;
var gl;
var circle_vertices;
var program;
var colorLocation;
var aspectRatioLocation;
var pi = Math.PI;
let texture;
var translation = [0, 0];
var angleInRadians = 0;
var scale = [0, 0];
var matrixLocation;

// cloud offset to use for cloud movement animation. multiple offsets as I am using different speeds per cloud.
let cloudOffsetX = 0;
let cloudOffsetX2 = 0;
let cloudOffsetX3 = 0;
var cloud_speed = 0.001; // cloud movement speed

var radVar = Math.PI / 180; // convert to radian

var nightColor = [0.376, 0.435, 0.569, 1.0]; // night time color multiplier

// day/night switcher
var DayTime = true;
var rotateNight = 0;
var rotateDay = 0;

// Main Function
window.onload = function init() {
  canvas = document.getElementById('webgl-canvas');
  gl = canvas.getContext('webgl');
  if (!gl) { alert("WebGL isn't available"); }
  resizeCanvasToDisplaySize();
  window.addEventListener('resize', init);
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc); 
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  aspectRatioLocation = gl.getUniformLocation(program, 'uAspectRatio');

  // here's where I load in the image texture from. 
  const image = new Image();
  image.crossOrigin = "annoynmous";
    // I am using an imgur screenshot link instead of a local file as the local file flared up an issue with CORS. imgur is public so its convenient for this purpose
  image.src = 'https://i.imgur.com/QZxUV6H.jpeg';
  image.onload = function() {
    initTexture(image); // initialize texture and render function
  };

  // this is the button event listener that lets you change from day to night and vice versa. it works by alternating the bool value of the daytime variable and also changing its icon for a nice effect
  document.getElementById('shift-scene-button').addEventListener('click', function() {
    DayTime = !DayTime;
    if (DayTime) {
      document.getElementById('shift-scene-button').innerHTML = '<i class="fas fa-moon"></i>';
      // default angles so it rotates to day
      rotateNight = 0;
      rotateDay = -90;
    } else {
      document.getElementById('shift-scene-button').innerHTML = '<i class="fas fa-sun"></i>';
      // default angles so it rotates to night
      rotateNight = -90;
      rotateDay = 0;
    }
  });



}

// initilization of the 2D texture happens here. it uploads the texture to the GPU then calls for the render function
function initTexture(image) {
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); // upload to GPU

  const error = gl.getError();
  if (error !== gl.NO_ERROR) {
    console.error('WebGL error during texture creation:', error);
  }

  // render function call
  render();
}

// create shader function. very basic and saves space
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

// the canvas has given me so many issues with resizing and scaling objects which was not warranted.
// this function resizes the canvas to match your window width/height. - one of the many procedures to combat the stretching issue.
// it still leaves empty spaces as the height does not match so the solution is not perfect. but it will do for this project.

function resizeCanvasToDisplaySize() {
  const container = document.getElementById('canvas-container');
  const displayWidth = container.clientWidth;
  const displayHeight = container.clientHeight;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
  }

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

// render function where the main rendering happens.
function render() {
  resizeCanvasToDisplaySize(); //resize canvas here

  gl.clearColor(1.0, 1.0, 1.0, 1.0); //color set to white as the canvas will not be visible either way
  gl.clear(gl.COLOR_BUFFER_BIT);

  // another step to fixing the stretching issue is setting aspect ratio relative to width and height of the canvas and directing it to the vertex shader to modify the position
  const aspectRatio = canvas.width / canvas.height;
  matrixLocation = gl.getUniformLocation(program, "uTransformationMatrix");
  gl.uniform1f(aspectRatioLocation, aspectRatio);

  var nightColorMultiplierLocation = gl.getUniformLocation(program, 'nightMult');
  var useMultiplierLocation = gl.getUniformLocation(program, 'useNightMult');
  
  // identity matrix resets any transformation on objects rendered under it
  const identityMatrix = m3.identity();
  gl.uniformMatrix3fv(matrixLocation, false, identityMatrix);
  
  // determines which background scenary to display
  if (DayTime){
    gl.uniform1i(useMultiplierLocation, false); //dont apply color multiplier
    transform_render_nightsky();
    transform_render_daysky();
    render_objects();
  } else {
    gl.uniform1i(useMultiplierLocation, false); //dont apply color multiplier
    transform_render_daysky();
    transform_render_nightsky();
    // apply the night colors to objects at night time
    gl.uniform1i(useMultiplierLocation, true);
    gl.uniform4fv(nightColorMultiplierLocation, nightColor);
    render_objects();
  }

  updateZTranslation();
  rotateSky();
  // call for cloud movement animation function
  updateCloudTranslation(cloud_speed);

  requestAnimationFrame(render);

}

function render_objects(){
    // render the clouds - parameters: cloudOffsetX, X, Y, scale 
    transform_render_cloud(cloudOffsetX, 0.9, 0.6, -0.1);
    transform_render_cloud(cloudOffsetX2, -0.5, -0.1, 0.11);
    transform_render_cloud(cloudOffsetX3, -0.2, 0.4, 0.06);
    transform_render_cloud(cloudOffsetX3, 1.3, 0.1, 0.03);
  
    
    // render the ground grass patch - parameters: X, Y
    transform_render_ground(0.0, -1.0);
    
    // render the trees - parameters: X, Y, scale, variant (1: dark green, 2: pine tree, 3: green, 4: pink)
    transform_render_tree(1.1, 0.05, 1, 2);
    transform_render_tree(1.25, -0.2, 0.6, 1);
    transform_render_tree(1.4, 0.1, 1, 4);
    transform_render_tree(1.5, -0.2, 0.8, 2);
    transform_render_tree(1.8, -0.1, 0.7, 1);
    transform_render_tree(2, -0.3, 0.9, 3);
    transform_render_tree(0.9, -0.2, 0.7, 1);
    transform_render_tree(0.6, -0.1, 0.5, 2);
    transform_render_tree(0.7, -0.3, 0.6, 3);
    transform_render_tree(1.65, -0.3, 0.8, 2);
    transform_render_tree(0.2, -0.3, 0.3, 1);
    transform_render_tree(0.4, -0.2, 0.4, 2);
  
  
    // render the house - parameters: X, Y, scale
    transform_render_house(-0.6, 0, 0.9);
  
    // render the car - parameters: X, Y, scale
    transform_render_car(-1.1, -0.75, 0.9);
  
    // person rendering, lets him change poses depending on day and night.
    if (DayTime) {
      // render standing person - parameters: X, Y, scale, variant (1: standing, 2: sleeping)
      transform_render_person(-0.05, -0.4, 1, 1);
    }
    else {
      // render sleeping person - same parameters as above
      transform_render_person(-0.17, -0.5, 1, 2);
  
      transform_render_Z(-0.1, -0.33, 0.3);
      transform_render_Z(-0.03, -0.3, 0.25);
      //transform_render_Z(-0.01, -0.27, 0.2);
      // render Z's over sleeping person to help better showcase that hes sleeping - parameters: X, Y, scale
    }
  
}
// animating cloud function. offsets the x values based on the speed defined and if it goes outside the canvas it resets to before the canvas to create a wrapping effect 
function updateCloudTranslation(speed) {
  cloudOffsetX += speed;
  cloudOffsetX2 += speed/2;
  cloudOffsetX3 += speed/1.5;
  if (cloudOffsetX > 4.0) {cloudOffsetX = -4.0;}
  if (cloudOffsetX2 > 4.0) {cloudOffsetX2 = -4.0;}
  if (cloudOffsetX3 > 4.0) {cloudOffsetX3 = -4.0;}
}

var zOffsetX = 0;
var zOffsetY = 0;
var zOffsetScale = 0;
var zRotation = 0;

// Z travel animation to make the scene slightly more alive.
function updateZTranslation() {
  zOffsetX += 0.0006;
  zOffsetY += 0.00025;
  zOffsetScale -= 0.0015;
  
  if (zOffsetX > 0.15 || zOffsetY > 0.3) {
    zOffsetX = 0;
    zOffsetY = 0;
    zOffsetScale = 0;
    zRotation = 0;
  }
  
  if (zRotation < 60) {zRotation += 0.1;}
}

// sky rotation transition to fit the storybook style I was going for.
function rotateSky(){
  if (DayTime) {
    if (rotateNight < 90) {rotateNight += 1;}
    if (rotateDay < 0) {rotateDay += 1;}
  } else {
    if (rotateNight < 0) {rotateNight += 1;}
    if (rotateDay < 90) {rotateDay += 1;}
  }

}
// I will only be commenting over the circle function as it is the one with the most depth. all functions are almost the same with minor differences
// that identify each shape

// square render & buffer functions. 
function render_square(vertices, rgbcolor) {
  var n = buffer_square(vertices, rgbcolor);
  if (n < 0) {
    console.log('Failed to set the positions of the vertices');
    return;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const textureLocation = gl.getUniformLocation(program, 'uTexture');
  gl.uniform1i(textureLocation, 0);

  gl.uniform1i(gl.getUniformLocation(program, 'useGradient'), false);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, n);
}


function buffer_square(vertices, rgbcolor) {
  var n = 4;
  var texCoords = [];
  for (let i = 0; i < vertices.length; i++) {
    texCoords.push(vertices[i] * 0.18 + 0.5);
  }
  var vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }
  
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  
  var aPosition = gl.getAttribLocation(program, 'vPosition');
  if (aPosition < 0) {
    console.log('Failed to get the storage location of vPosition');
    return -1;
  }
  texCoords = new Float32Array(texCoords);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  
  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  
  const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
  gl.enableVertexAttribArray(aTexCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  
  colorLocation = gl.getUniformLocation(program, 'fColor');
  gl.uniform4fv(colorLocation, rgbcolor);
  
  return n;
}

// square gradient & buffer functions
function render_gradient_square(vertices, rgbcolors) {
  var n = buffer_gradient_square(vertices, rgbcolors);
  if (n < 0) {
    console.log('Failed to set the positions of the vertices');
    return;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const textureLocation = gl.getUniformLocation(program, 'uTexture');
  gl.uniform1i(textureLocation, 0);

  gl.uniform1i(gl.getUniformLocation(program, 'useGradient'), true);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, n);
}

function buffer_gradient_square(vertices, rgbcolor) {
  var n = 4;
  var texCoords = [];
  for (let i = 0; i < vertices.length; i++) {
    texCoords.push(vertices[i] * 0.18 + 0.5);
  }
  var vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }
  
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  
  var aPosition = gl.getAttribLocation(program, 'vPosition');
  if (aPosition < 0) {
    console.log('Failed to get the storage location of vPosition');
    return -1;
  }
  texCoords = new Float32Array(texCoords);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  
  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  
  const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
  gl.enableVertexAttribArray(aTexCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rgbcolor), gl.STATIC_DRAW);
  
  const aColor = gl.getAttribLocation(program, 'aColor');
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
  
  return n;
}

// circle render & buffer functions
function buffer_circle(vertices, rgbcolor) {
  // a lot of variables to help control the circle shape
  // w_mult, h_mult are width/height multipliers that help stretch our the circle to make more shapes
  // start/end angles are for semi circle control
  var [cx, cy, radius, numSegments, w_mult, h_mult, start_angle, end_angle] = vertices;
  var circle_vertices = [];
  var texCoords = []; // we are supposed to derive the texture coordinates from the normal coords of vertices and normalize them to fit in [0,1]
  var divider = (end_angle - start_angle) / numSegments; // angle divider to get the angle over number of segments

  // basic circle vertices grabber function
  for (let i = 0; i <= numSegments; i++) {
    const angle = start_angle + (i * divider);
    const x = (cx + radius * Math.cos(angle)) * w_mult; // width multiplier is usually default to 1
    const y = (cy + radius * Math.sin(angle)) * h_mult; // height multiplier is usually default to 1
    circle_vertices.push(x, y); // push vertices

    // here we normalize the x and y vertices to put them in as the texture coords.
    // why is the function exactly like this? I have no clue but it works and i am not complaining
    const u = 0.5 + 0.18 * x;
    const v = 0.5 + 0.18 * y;
    texCoords.push(u, v);
  }

  if (circle_vertices.length < 1) {
    console.log('Failed to set the positions of the vertices');
    return;
  }

  circle_vertices = new Float32Array(circle_vertices);
  texCoords = new Float32Array(texCoords);

  var vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, circle_vertices, gl.STATIC_DRAW);

  var aPosition = gl.getAttribLocation(program, 'vPosition');
  if (aPosition < 0) {
    console.log('Failed to get the storage location of vPosition');
    return -1;
  }
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

  const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
  gl.enableVertexAttribArray(aTexCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

  colorLocation = gl.getUniformLocation(program, 'fColor');
  gl.uniform4fv(colorLocation, rgbcolor);

  return circle_vertices
}



function render_circle(vertices, rgbcolor) {
  var n = buffer_circle(vertices, rgbcolor);

  if (n < 0) {
    console.log('Failed to set the positions of the vertices');
    return;
  }
  // binding the texture i defined
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const textureLocation = gl.getUniformLocation(program, 'uTexture');
  gl.uniform1i(textureLocation, 0);
  // every shape has this to prevent gradient except for gradient square
  gl.uniform1i(gl.getUniformLocation(program, 'useGradient'), false);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, n.length / 2);
}


// triangle render & buffer functions
function render_triangle(vertices, rgbcolor) {
  var n = buffer_triangle(vertices, rgbcolor);
  if (n < 0) {
    console.log('Failed to set the positions of the vertices');
    return;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const textureLocation = gl.getUniformLocation(program, 'uTexture');
  gl.uniform1i(textureLocation, 0);
  
  gl.uniform1i(gl.getUniformLocation(program, 'useGradient'), false);
  gl.drawArrays(gl.TRIANGLES, 0, n);
}


function buffer_triangle(vertices, rgbcolor) {
  var n = 3;
  var texCoords = [];
  for (let i = 0; i < vertices.length; i++) {
    texCoords.push(vertices[i] * 0.18 + 0.5);
  }
  var vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }
    
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
  var aPosition = gl.getAttribLocation(program, 'vPosition');
  if (aPosition < 0) {
    console.log('Failed to get the storage location of vPosition');
    return -1;
  }
  texCoords = new Float32Array(texCoords);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  
  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  
  const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
  gl.enableVertexAttribArray(aTexCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  
  colorLocation = gl.getUniformLocation(program, 'fColor');
  gl.uniform4fv(colorLocation, rgbcolor);
  
  return n;
}


/* OBJECT RENDER FUNCTIONS */
// objects are created at 0,0 coordinates to be able to use translation transformation on them with ease.

// House
function render_house(){
    var house = {
    body_v: new Float32Array([
      -0.4, -0.85, // Bottom left
      0.4, -0.85, // Bottom Right
      0.4, 0.1, // Top Right
      -0.4, 0.1, // Top Left
    ]),
    body_top_v: new Float32Array([
      -0.4, 0.1, // Bottom left
      0.4, 0.1, // Bottom Right
      0, 0.5, // Top
    ]),
    body_roof_v1: new Float32Array([
      -0.43, 0.06, // Bottom left
      0, 0.5, // Bottom Right
      0, 0.63, // Top Right
      -0.43, 0.18, // Top Left
    ]),
    body_roof_v2: new Float32Array([
      0, 0.5, // Bottom left
      0.43, 0.06, // Bottom Right
      0.43, 0.18, // Top Right
      0, 0.63, // Top Left
    ]),
    garage_v: new Float32Array([
      -1.3, -0.85, // Bottom left
      -0.4, -0.85, // Bottom Right
      -0.4, -0.2, // Top Right
      -1.3, -0.2, // Top Left
    ]),
    garage_door_v: new Float32Array([
      -1.2, -0.85, // Bottom left
      -0.5, -0.85, // Bottom Right
      -0.5, -0.35, // Top Right
      -1.2, -0.35, // Top Left
    ]),
    garage_doorline1_v: new Float32Array([
      -1.2, -0.52, // Bottom left
      -0.5, -0.52, // Bottom Right
      -0.5, -0.47, // Top Right
      -1.2, -0.47, // Top Left
    ]),
    garage_doorline2_v: new Float32Array([
      -1.2, -0.65, // Bottom left
      -0.5, -0.65, // Bottom Right
      -0.5, -0.6, // Top Right
      -1.2, -0.6, // Top Left
    ]),
    garage_doorline3_v: new Float32Array([
      -1.2, -0.78, // Bottom left
      -0.5, -0.78, // Bottom Right
      -0.5, -0.73, // Top Right
      -1.2, -0.73, // Top Left
    ]),
    garage_top_v: new Float32Array([
      -1.3, -0.2, // Bottom left
      -0.4, -0.2, // Bottom Right
      -0.4, -0.05, // Top
    ]),
    garage_roof_v: new Float32Array([
      -1.33, -0.25, // Bottom left
      -0.4, -0.05, // Bottom Right
      -0.4, 0.05, // Top Right
      -1.33, -0.15, // Top Left
    ]),
    door_top_v : [ 0, -0.45, 0.15, 10, 1, 1, 0, pi],
    window_frame_v : [ 0, 0, 0.15, 10, 1, 1, 0, pi*2],
    window_top_v : [ 0, 0, 0.11, 10, 1, 1, 0, pi*2],
    door_bottom_v: new Float32Array([
      -0.15, -0.85, // Bottom left
      0.15, -0.85, // Bottom Right
      0.15, -0.45, // Top Right
      -0.15, -0.45, // Top Left
    ]),
    door_top_inside_v : [ 0, -0.45, 0.11, 10, 1, 1, 0, pi],
    door_bottom_inside_v: new Float32Array([
      -0.11, -0.85, // Bottom left
      0.11, -0.85, // Bottom Right
      0.11, -0.45, // Top Right
      -0.11, -0.45, // Top Left
    ]),
    // r, g, b, a
    red_c_light : [0.729, 0.118, 0.118, 1.0],
    red_c_dark : [0.671, 0.106, 0.106, 1.0],

    gray_c_light : [0.839, 0.824, 0.824, 1.0],
    gray_c_dark : [0.729, 0.737, 0.761, 1.0],
    brown_c: [0.400, 0.341, 0.294, 1.0],

    black_c: [0.322, 0.059, 0.059, 1.0],
  }

  render_square(house.body_v, house.red_c_light);
  render_triangle(house.body_top_v, house.red_c_light);
  render_square(house.body_roof_v1, house.black_c);
  render_square(house.body_roof_v2, house.black_c);

  render_square(house.garage_v, house.red_c_dark);
  render_square(house.garage_door_v, house.gray_c_light);
  render_square(house.garage_doorline1_v, house.gray_c_dark);
  render_square(house.garage_doorline2_v, house.gray_c_dark);
  render_square(house.garage_doorline3_v, house.gray_c_dark);

  render_triangle(house.garage_top_v, house.red_c_dark);
  render_square(house.garage_roof_v, house.black_c);
  render_circle(house.door_top_v, house.black_c);
  render_circle(house.door_top_inside_v, house.brown_c);
  render_circle(house.window_frame_v, house.black_c);
  render_circle(house.window_top_v, house.brown_c);
  render_square(house.door_bottom_v, house.black_c);
  render_square(house.door_bottom_inside_v, house.brown_c);
}

// Trees
function render_tree(variant){
  var tree = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    generic_v_tright: [0, 0, 0.19, 10, 1, 1.1, -pi / 2, pi / 2],
    generic_v_tleft: [0, 0, 0.19, 10, 1, 1.1, pi / 2, 3 * pi / 2],
    generic_v_bright: [0, -0.3, 0.25, 10, 1, 1.1, -pi / 2, pi / 2],
    generic_v_bleft: [0, -0.3, 0.25, 10, 1, 1.1, pi / 2, 3 * pi / 2],

    pine_v_tright: new Float32Array([
      0, -0.5, // Bottom left
      0.35, -0.5, // Bottom Right
      0, 0, // Top
    ]),
    pine_v_tleft: new Float32Array([
      -0.35, -0.5, // Bottom left
      0, -0.5, // Bottom Right
      0, 0, // Top
    ]),
    pine_v_mright: new Float32Array([
      0, -0.3, // Bottom left
      0.3, -0.3, // Bottom Right
      0, 0.25, // Top
    ]),
    pine_v_mleft: new Float32Array([
      -0.3, -0.3, // Bottom left
      0, -0.3, // Bottom Right
      0, 0.25, // Top
    ]),
    pine_v_bright: new Float32Array([
      0, -0.05, // Bottom left
      0.25, -0.05, // Bottom Right
      0, 0.35, // Top
    ]),
    pine_v_bleft: new Float32Array([
      -0.25, -0.05, // Bottom left
      0, -0.05, // Bottom Right
      0, 0.35, // Top
    ]),

    trunk_v: new Float32Array([
      -0.02, -0.85, // Bottom left
      0.02, -0.85, // Bottom Right
      0.02, 0.1, // Top Right
      -0.02, 0.1, // Top Left
    ]),
    branch_v_left: new Float32Array([
      0, -0.35, // Bottom left
      0, -0.4, // Bottom Right
      -0.15, -0.3, // Top Right
      -0.15, -0.25, // Top Left
    ]),
    branch_v_right: new Float32Array([
      0, -0.1, // Bottom left
      0, -0.05, // Bottom Right
      0.1, 0.05, // Top Right
      0.1, 0, // Top Left
    ]),
    pine_branch_v_right: new Float32Array([
      0, -0.19, // Bottom left
      0, -0.25, // Bottom Right
      0.15, -0.45, // Top Right
      0.15, -0.39, // Top Left
    ]),
    pine_branch_v_left: new Float32Array([
      0, -0.05, // Bottom left
      0, -0.1, // Bottom Right
      -0.15, -0.25, // Top Right
      -0.15, -0.2, // Top Left
    ]),
    // r, g, b, a
    dark_green_c_light : [0.204, 0.451, 0.051, 1.0],
    dark_green_c_dark : [0.165, 0.369, 0.039, 1.0],

    pink_c_light : [0.843, 0.314, 0.576, 1.0],
    pink_c_dark : [0.635, 0.161, 0.384, 1.0],

    green_c_light : [0.439, 0.612, 0.184, 1.0],
    green_c_dark : [0.357, 0.510, 0.133, 1.0],

    trunk_c: [0.388, 0.196, 0.102, 1.0],
  }
  if (variant == 1) {
  // Leaves
  render_circle(tree.generic_v_tright, tree.dark_green_c_light);
  render_circle(tree.generic_v_tleft, tree.dark_green_c_dark);
  render_circle(tree.generic_v_bright, tree.dark_green_c_light);
  render_circle(tree.generic_v_bleft, tree.dark_green_c_dark);
  // Trunk
  render_square(tree.trunk_v, tree.trunk_c);
  // Branches
  render_square(tree.branch_v_left, tree.trunk_c);
  render_square(tree.branch_v_right, tree.trunk_c);

  } else if (variant == 2) {
    // Leaves
    render_triangle(tree.pine_v_tright, tree.green_c_light);
    render_triangle(tree.pine_v_tleft, tree.green_c_dark);
    render_triangle(tree.pine_v_mright, tree.green_c_light);
    render_triangle(tree.pine_v_mleft, tree.green_c_dark);
    render_triangle(tree.pine_v_bright, tree.green_c_light);
    render_triangle(tree.pine_v_bleft, tree.green_c_dark);
    // Trunk
    render_square(tree.trunk_v, tree.trunk_c);
    // Branches
    render_square(tree.pine_branch_v_left, tree.trunk_c);
    render_square(tree.pine_branch_v_right, tree.trunk_c);  
  } else if (variant == 3) {
    // Leaves
    render_circle(tree.generic_v_tright, tree.green_c_light);
    render_circle(tree.generic_v_tleft, tree.green_c_dark);
    render_circle(tree.generic_v_bright, tree.green_c_light);
    render_circle(tree.generic_v_bleft, tree.green_c_dark);
    // Trunk
    render_square(tree.trunk_v, tree.trunk_c);
    // Branches
    render_square(tree.branch_v_left, tree.trunk_c);
    render_square(tree.branch_v_right, tree.trunk_c);

  }
 else if (variant == 4) {
  // Leaves
  render_circle(tree.generic_v_tright, tree.pink_c_light);
  render_circle(tree.generic_v_tleft, tree.pink_c_dark);
  render_circle(tree.generic_v_bright, tree.pink_c_light);
  render_circle(tree.generic_v_bleft, tree.pink_c_dark);
  // Trunk
  render_square(tree.trunk_v, tree.trunk_c);
  // Branches
  render_square(tree.branch_v_left, tree.trunk_c);
  render_square(tree.branch_v_right, tree.trunk_c);

}
}

// Sleeping Z's
function render_zs(){
  var z = {
    z_stroke_bottom: new Float32Array([
      -0.07, -0.26, // Bottom left
      -0.07, -0.22, // Bottom Right
      0.15, -0.22, // Top Right
      0.15, -0.26, // Top Left
    ]),
    z_stroke_middle: new Float32Array([
      -0.07, -0.26, // Bottom left
      -0.07, -0.22, // Bottom Right
      0.15, -0.04, // Top Right
      0.15, -0.08, // Top Left
    ]),
    z_stroke_top: new Float32Array([
      -0.07, -0.08, // Bottom left
      -0.07, -0.04, // Top Left
      0.15, -0.04, // Top Right
      0.15, -0.08, // Bottom Right
    ]),
    green_c_light : [0.980, 0.949, 0.941, 1.0],
  }
  render_square(z.z_stroke_bottom, z.green_c_light);
  render_square(z.z_stroke_middle, z.green_c_light);
  render_square(z.z_stroke_top, z.green_c_light);
}

// Person
function render_person(variant){
  var person = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    head_v: [0, 0, 0.07, 10, 1, 1, 0, pi*2],
    body_awake_v: new Float32Array([
      -0.025, -0.04, // Bottom left
      0.025, -0.04, // Bottom Right
      0.025, -0.23, // Top Right
      -0.025, -0.23, // Top Left
    ]),
    leg_right_awake_v: new Float32Array([
      0.025, -0.23, // Bottom left
      0.08, -0.35, // Bottom Right
      0.03, -0.35, // Top Right
      -0.01, -0.23, // Top Left
    ]),
    leg_left_awake_v: new Float32Array([
      -0.025, -0.23, // Bottom left
      -0.08, -0.35, // Bottom Right
      -0.03, -0.35, // Top Right
      0.01, -0.23, // Top Left
    ]),
    arm_topright_awake_v: new Float32Array([
      0.025, -0.08, // Bottom left
      0.08, -0.15, // Bottom Right
      0.08, -0.2, // Top Right
      0.025, -0.15, // Top Left
    ]),
    arm_topleft_awake_v: new Float32Array([
      -0.025, -0.08, // Bottom left
      -0.08, -0.15, // Bottom Right
      -0.08, -0.2, // Top Right
      -0.025, -0.15, // Top Left
    ]),

    body_sleep_v: new Float32Array([
      -0.07, -0.005, // Bottom left
      -0.025, -0.005, // Bottom Right
      -0.025, -0.23, // Top Right
      -0.07, -0.23, // Top Left
    ]),
    leg_right_sleep_v: new Float32Array([
      -0.07, -0.26, // Bottom left
      -0.07, -0.22, // Bottom Right
      0.19, -0.22, // Top Right
      0.19, -0.26, // Top Left
    ]),
    leg_right_left_sleep_v: new Float32Array([
      0.06, -0.13, // Bottom left
      0.12, -0.25, // Bottom Right
      0.16, -0.25, // Top Right
      0.10, -0.13, // Top
    ]),
    leg_left_left_sleep_v: new Float32Array([
      0.09, -0.13, // Bottom left
      -0.03, -0.25, // Bottom Right
      -0.07, -0.25, // Top Right
      0.05, -0.13, // Top
    ]),
    arm_left_sleep_v: new Float32Array([
      -0.07, -0.14, // Bottom left
      -0.07, -0.1, // Bottom Right
      0.14, -0.1, // Top Right
      0.14, -0.14, // Top Left
    ]),
    // r, g, b, a
    person_c_light : [0.969, 0.906, 0.804, 1.0],
    person_c_dark : [0.851, 0.761, 0.612, 1.0],
  }
  if (variant == 1) {
  render_circle(person.head_v, person.person_c_light);
  render_square(person.body_awake_v, person.person_c_light);
  render_square(person.leg_right_awake_v, person.person_c_light);
  render_square(person.leg_left_awake_v, person.person_c_light);
  render_square(person.arm_topright_awake_v, person.person_c_light);
  render_square(person.arm_topleft_awake_v, person.person_c_light);
  } else if (variant == 2) {
  render_circle(person.head_v, person.person_c_light);
  render_square(person.leg_left_left_sleep_v, person.person_c_dark);
  render_square(person.leg_right_left_sleep_v, person.person_c_dark);
  render_square(person.leg_right_sleep_v, person.person_c_light);
  render_square(person.arm_left_sleep_v, person.person_c_dark);
  render_square(person.body_sleep_v, person.person_c_light);
  }

}

// Car
function render_car(){
  var car = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    car_left_v : [-0.4, 0, 0.25, 10, 1, 1.25, 0, pi],
    car_mid_v : [0, 0, 0.4, 10, 1, 1.3, 0, pi],
    car_right_v : [0.4, 0, 0.25, 10, 1, 1.25, 0, pi],

    car_wheel_right_v : [0.4, 0, 0.15, 10, 1, 1.1, 0, pi*2],
    car_wheel_left_v : [-0.4, 0, 0.15, 10, 1, 1.1, 0, pi*2],

    car_window_v : [0, 0.21, 0.12, 10, 2, 1.3, 0, pi],

    car_wheel_right_inside_v : [0.4, 0, 0.08, 10, 1, 1.1, 0, pi*2],
    car_wheel_left_inside_v : [-0.4, 0, 0.08, 10, 1, 1.1, 0, pi*2],

    // r, g, b, a
    car_c_light : [0.227, 0.486, 0.780, 1.0],
    car_c_dark : [0.012, 0.337, 0.600, 1.0],
    tire_c_light : [0.075, 0.118, 0.149, 1.0],
    tire_c_dark : [0.027, 0.063, 0.090, 1.0],
  }
  render_circle(car.car_left_v, car.car_c_light);
  render_circle(car.car_mid_v, car.car_c_light);
  render_circle(car.car_right_v, car.car_c_light);
  render_circle(car.car_window_v, car.car_c_dark);
  render_circle(car.car_wheel_right_v, car.tire_c_dark);
  render_circle(car.car_wheel_left_v, car.tire_c_dark);
  render_circle(car.car_wheel_right_inside_v, car.tire_c_light);
  render_circle(car.car_wheel_left_inside_v, car.tire_c_light);
}

// Sun
function render_sun(){
  var sun = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    sun_v : [ 0, 0, 0.12, 10, 1, 1, 0, 2*pi],
    // r, g, b, a
    sun_c : [0.957, 0.925, 0.502, 1.0],
  }
  render_circle(sun.sun_v, sun.sun_c);
}

// Moon
function render_moon() {
  var moon = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    full_moon_v: [0, 0, 0.12, 10, 1, 1, 0, 2 * pi],
    cutout_v: [-0.06, 0, 0.11, 10, 1, 1, 0, 2 * pi],
    // r, g, b, a
    moon_c: [0.980, 0.949, 0.941, 1.0],
    background_c: [0.075, 0.090, 0.149, 1.0],
  }
  render_circle(moon.full_moon_v, moon.moon_c);
  render_circle(moon.cutout_v, moon.background_c);
}

// Ground
function render_ground(){
  var ground = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    ground_v : [0, 0, 0.5, 100, 5, 1, 0, 2*pi],
    // r, g, b, a
    ground_c : [0.655, 0.702, 0.290, 1.0],
  }
  render_circle(ground.ground_v, ground.ground_c);
}

// Clouds
function render_cloud(scale){
  var cloud = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    cloud_v_left : [-0.3 - scale, 0, 0.18 + scale, 10, 1 + scale, 1.1, 0, pi],
    cloud_v_middle : [0, 0, 0.25 + scale, 10, 1, 1.1, 0, pi],
    cloud_v_right : [0.3 + scale, 0, 0.14 + scale, 10, 1 + scale, 1.1, 0, pi],
    // r, g, b, a
    cloud_c_light : [0.980, 0.949, 0.941, 1.0],
    cloud_c_dark : [0.933, 0.906, 0.898, 1.0],
  }
  render_circle(cloud.cloud_v_left, cloud.cloud_c_dark);
  render_circle(cloud.cloud_v_middle, cloud.cloud_c_light);
  render_circle(cloud.cloud_v_right, cloud.cloud_c_light);
}
// Stars
function render_star(){
  var star = {
    // x, y, radius, segments, width_multiplier, height_multiplier, start_angle, end_angle
    star_middle_v : [0, 0, 0.1, 5, 1, 1.1, 0, pi*2],

    star_tri_v_1: new Float32Array([
      -0.082, 0.06, // Bottom left
      0.035, 0.1, // Bottom Right
      -0.06, 0.2, // Top
    ]),
    star_tri_v_2: new Float32Array([
      0.034, 0.1, // Bottom left
      0.1, 0, // Bottom Right
      0.18, 0.14, // Top
    ]),
    star_tri_v_3: new Float32Array([
      0.1, 0, // Bottom left
      0.03, -0.105, // Bottom Right
      0.19, -0.14, // Top
    ]),
    star_tri_v_4: new Float32Array([
      0.035, -0.1, // Bottom left
      -0.081, -0.06, // Bottom Right
      -0.1, -0.2, // Top
    ]),
    star_tri_v_5: new Float32Array([
      -0.08, -0.06, // Bottom left
      -0.081, 0.06, // Bottom Right
      -0.23, 0, // Top
    ]),

    // r, g, b, a
    star_c : [1.0, 0.839, 0.259, 1.0],
  }
  render_circle(star.star_middle_v, star.star_c);
  render_triangle(star.star_tri_v_1, star.star_c);
  render_triangle(star.star_tri_v_2, star.star_c);
  render_triangle(star.star_tri_v_3, star.star_c);
  render_triangle(star.star_tri_v_4, star.star_c);
  render_triangle(star.star_tri_v_5, star.star_c);
}
// Sky - Day
function render_sky_day(){
  var sky = {
    sky_v : new Float32Array([
      -4, -2, // Bottom left
      2, -2, // Bottom Right
      2, 4, // Top Right
      -4, 4, // Top Left
    ]),
    // r, g, b, a
    // gradient colors
    sky_c: [
      0.0, 0.749, 1.0, 1.0, // Top Right
      0.588, 0.859, 0.933, 1.0, // Bottom left
      0.588, 0.859, 0.933, 1.0, // Bottom Right
      0.0, 0.749, 1.0, 1.0, // Top Left
    ],
  }
  render_gradient_square(sky.sky_v, sky.sky_c);

  transform_render_sun(3.3, -1.2);
}
// Sky - Night
function render_sky_night(){
  var sky = {
    sky_v : new Float32Array([
      -4, -2, // Bottom left
      2, -2, // Bottom Right
      2, 4, // Top Right
      -4, 4, // Top Left
    ]),
    // r, g, b, a
    sky_c : [0.075, 0.090, 0.149, 1.0],
  }
  render_square(sky.sky_v, sky.sky_c);

  // rendering a bunch of stars in the night sky
  transform_render_star(-0.8, 0.3, 0.25);
  transform_render_star(0.6, 0.6, 0.15);
  transform_render_star(-0.4, 0.2, 0.2);
  transform_render_star(1, 0.1, 0.2);
  transform_render_star(1.4, 0.3, 0.15);
  transform_render_star(0.2, 0.3, 0.25);
  transform_render_star(0.1, -0.1, 0.2);
  transform_render_star(2, 0.3, 0.15);
  transform_render_star(0.5, 0.3, 0.15);
  transform_render_star(1.8, 0.1, 0.15);
  transform_render_star(-1.2, 0, 0.15);
  transform_render_star(-1.5, 0.3, 0.15);
  transform_render_moon(3.3, -1.2);
}

// transformation functions for each shape. this is to help move/scale shapes relatively by adding the desired x,y values and sometimes even scale
function transform_render_star(X, Y, scale) {
  var moveOrigin = m3.translation(-2, 2);
  var moveToOrigin = m3.translation(2, -2);
  
  var transformationMatrix = m3.multiply(moveToOrigin, m3.rotation(-rotateNight * radVar));
  transformationMatrix = m3.multiply(transformationMatrix, moveOrigin);
  transformationMatrix = m3.multiply(transformationMatrix, m3.translation(X, Y));
  transformationMatrix = m3.multiply(transformationMatrix, m3.scaling(scale, scale));
  transformationMatrix = m3.multiply(transformationMatrix, moveOrigin);
  
  gl.uniformMatrix3fv(matrixLocation, false, transformationMatrix);
  render_star();
}

function transform_render_moon(X, Y) {
  var moveOrigin = m3.translation(-2, 2);
  var moveToOrigin = m3.translation(2, -2);
  
  var transformationMatrix = m3.multiply(moveToOrigin, m3.rotation(-rotateNight * radVar));
  transformationMatrix = m3.multiply(transformationMatrix, moveOrigin);
  transformationMatrix = m3.multiply(transformationMatrix, m3.translation(X, Y));
  transformationMatrix = m3.multiply(transformationMatrix, moveOrigin);
  
  gl.uniformMatrix3fv(matrixLocation, false, transformationMatrix);
  render_moon();
}

function transform_render_sun(X, Y) {
  var moveOrigin = m3.translation(-2, 2);
  var moveToOrigin = m3.translation(2, -2);
  
  var transformationMatrix = m3.multiply(moveToOrigin, m3.rotation(-rotateDay * radVar));
  transformationMatrix = m3.multiply(transformationMatrix, moveOrigin);
  transformationMatrix = m3.multiply(transformationMatrix, m3.translation(X, Y));
  transformationMatrix = m3.multiply(transformationMatrix, moveOrigin);
  
  gl.uniformMatrix3fv(matrixLocation, false, transformationMatrix);
  render_sun();
}

function transform_render_cloud(offsetX, X, Y, scale) {
  offsetX = offsetX + X;
  const translationMatrix = m3.translation(offsetX, Y);
  gl.uniformMatrix3fv(matrixLocation, false, translationMatrix);
  render_cloud(scale);
}

function transform_render_tree(X, Y, scale, variant) {
  const transformationMatrix = m3.multiply(m3.translation(X, Y), m3.scaling(scale, scale));
  gl.uniformMatrix3fv(matrixLocation, false, transformationMatrix);
  render_tree(variant);
}

function transform_render_ground(X, Y) {
  const translationMatrix = m3.translation(X, Y);
  gl.uniformMatrix3fv(matrixLocation, false, translationMatrix);
  render_ground();
}

function transform_render_Z(X, Y, scale) {
  X = X + zOffsetX;
  Y = Y + zOffsetY;
  scale = scale + zOffsetScale;
  if (scale < 0) {scale = 0;};
  var scaleMatrix = m3.scaling(scale, scale);
  var rotationMatrix = m3.rotation(zRotation * radVar);
  var translationMatrix = m3.translation(X, Y);

  var matrix = m3.multiply(rotationMatrix, scaleMatrix);
  matrix = m3.multiply(translationMatrix, matrix);
  
  gl.uniformMatrix3fv(matrixLocation, false, matrix);
  render_zs();
}

function transform_render_person(X, Y, scale, variant) {
  const transformationMatrix = m3.multiply(m3.translation(X, Y), m3.scaling(scale, scale));
  gl.uniformMatrix3fv(matrixLocation, false, transformationMatrix);
  render_person(variant);
}

function transform_render_house(X, Y, scale) {
  const transformationMatrix = m3.multiply(m3.translation(X, Y), m3.scaling(scale, scale));
  gl.uniformMatrix3fv(matrixLocation, false, transformationMatrix);
  render_house();
}

function transform_render_car(X, Y, scale) {
  const transformationMatrix = m3.multiply(m3.translation(X, Y), m3.scaling(scale, scale));
  gl.uniformMatrix3fv(matrixLocation, false, transformationMatrix);
  render_car();
}

function transform_render_nightsky() {
  var translationMatrix = m3.translation(2, -2);
  var rotationMatrix = m3.rotation(-rotateNight * radVar);
  var moveOrigin = m3.translation(-2, 2);

  var matrix = m3.multiply(translationMatrix, rotationMatrix);
  matrix = m3.multiply(matrix, moveOrigin);

  gl.uniformMatrix3fv(matrixLocation, false, matrix);
  render_sky_night(matrix);
}

function transform_render_daysky() {
  var translationMatrix = m3.translation(2, -2);
  var rotationMatrix = m3.rotation(-rotateDay * radVar);
  var moveOrigin = m3.translation(-2, 2);

  var matrix = m3.multiply(translationMatrix, rotationMatrix);
  matrix = m3.multiply(matrix, moveOrigin);

  gl.uniformMatrix3fv(matrixLocation, false, matrix);
  render_sky_day();
}

/* MATRIX DICTIONARY */
// where the transformation magic happens

var m3 = {
  identity: function() {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
  },

  translation: function(tx, ty) {
    return [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ];
  },

  rotation: function(angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);
    return [
      c,-s, 0,
      s, c, 0,
      0, 0, 1,
    ];
  },

  scaling: function(sx, sy) {
    return [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ];
  },

  multiply: function(a, b) {
    var a00 = a[0 * 3 + 0];
    var a01 = a[0 * 3 + 1];
    var a02 = a[0 * 3 + 2];
    var a10 = a[1 * 3 + 0];
    var a11 = a[1 * 3 + 1];
    var a12 = a[1 * 3 + 2];
    var a20 = a[2 * 3 + 0];
    var a21 = a[2 * 3 + 1];
    var a22 = a[2 * 3 + 2];
    var b00 = b[0 * 3 + 0];
    var b01 = b[0 * 3 + 1];
    var b02 = b[0 * 3 + 2];
    var b10 = b[1 * 3 + 0];
    var b11 = b[1 * 3 + 1];
    var b12 = b[1 * 3 + 2];
    var b20 = b[2 * 3 + 0];
    var b21 = b[2 * 3 + 1];
    var b22 = b[2 * 3 + 2];
    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
    ];
  },
};
