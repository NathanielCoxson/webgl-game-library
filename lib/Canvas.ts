import Rectangle from "./Rectangle";
import Circle from "./Circle";
import * as G from "./Graphics";

export default class Canvas {
    gl: WebGLRenderingContext | null;
    success: boolean;
    vertexShader:       WebGLShader | undefined;
    texFragmentShader:  WebGLShader | undefined;
    fillFragmentShader: WebGLShader | undefined;
    texProgram:  WebGLProgram | undefined;
    fillProgram: WebGLProgram | undefined;
    texPositionAttributeLocation: any;
    fillPositionAttributeLocation: any;
    positionBuffer: any;
    texCoordLocation: any;
    texCoordBuffer: any;
    texResolutionUniformLocation: any;
    fillResolutionUniformLocation: any;
    colorUniformLocation: any;
    
    // Shape buffers
    rectangles: Rectangle[];
    circles: Circle[];

    // Canvas info
    width:  number;
    height: number
    
    constructor(
        canvasElement: any
    ) {
        if (!canvasElement) {
            this.success = false;
            this.gl = null;
            return;
        }
        this.gl = canvasElement.getContext("webgl");
        if (this.gl) {
            this.success = true;
        } else {
            this.success = false;
            return;
        }

        this.rectangles = [];
        this.circles    = [];

        this.width  = this.gl.canvas.width;
        this.height = this.gl.canvas.height;
        
        const vertexShaderSource: any = document.querySelector("#vertex-shader-2d")?.textContent;
        const fragmentShaderSource: any = document.querySelector("#fragment-shader-2d")?.textContent;
        const fillFragmentShaderSource: any = document.querySelector("#fragment-shader-vertex-color")?.textContent;
        this.vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);
        if (!this.vertexShader) {
            this.success = false;
            return;
        } 
        this.texFragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        if (!this.texFragmentShader) {
            this.success = false;
            return;
        } 
        this.fillFragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, fillFragmentShaderSource);
        if (!this.fillFragmentShader) {
            this.success = false;
            return;
        }

        this.texProgram = createProgram(this.gl, this.vertexShader, this.texFragmentShader);
        if (!this.texProgram) {
            this.success = false;
            return;
        }
        this.fillProgram = createProgram(this.gl, this.vertexShader, this.fillFragmentShader);
        if (!this.fillProgram) {
            this.success = false;
            return;
        }

        this.texPositionAttributeLocation = this.gl.getAttribLocation(this.texProgram, "a_position");
        this.fillPositionAttributeLocation = this.gl.getAttribLocation(this.fillProgram, "a_position");
        this.texCoordLocation = this.gl.getAttribLocation(this.texProgram, "a_texCoord");

        // Create position buffer
        this.positionBuffer = this.gl.createBuffer();

        // Create texture position buffer
        this.texCoordBuffer = this.gl.createBuffer();

        this.texResolutionUniformLocation = this.gl.getUniformLocation(this.texProgram, "u_resolution");
        this.fillResolutionUniformLocation = this.gl.getUniformLocation(this.fillProgram, "u_resolution");

        resizeCanvasToDisplaySize(this.gl.canvas);

        this.gl.useProgram(this.texProgram);
        this.gl.uniform2f(this.texResolutionUniformLocation, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.useProgram(this.fillProgram);
        this.gl.uniform2f(this.fillResolutionUniformLocation, this.gl.canvas.width, this.gl.canvas.height);

        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);


        this.colorUniformLocation = this.gl.getUniformLocation(this.fillProgram, "u_color");
    }

    draw(rect: Rectangle): void {
        if (!this.success) return;
        this.rectangles.push(rect);
    }

    drawTexture(
        texture: {
            width: number,
            height: number,
            image: HTMLImageElement, 
        },
        position: G.Position
    ) {
        if (!this.success || !this.gl) return;
        if (!this.texProgram) return;

        // Use texture program
        this.gl.useProgram(this.texProgram);

        // Bind texture
        const tex = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, tex);

        // Set texture parameters to fill contents 
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        // Load the image into the texture
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, texture.image);

        // Bind position buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        setRectangle(this.gl, position.x, position.y, texture.width, texture.height);
        this.gl.enableVertexAttribArray(this.texPositionAttributeLocation);
        this.gl.vertexAttribPointer(this.texPositionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Bind texture coordinate buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            0.0,  0.0,
            1.0,  0.0,
            0.0,  1.0,
            0.0,  1.0,
            1.0,  0.0,
            1.0,  1.0,
        ]), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Draw arrays
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    drawFilled(rect: Rectangle) {
        if (!this.gl || !this.success) return;
        if (!rect.hasFillColor) return;
        if (!this.fillProgram) return;

        // Use fill program
        this.gl.useProgram(this.fillProgram);

        // Set color uniform
        this.gl.uniform4f(this.colorUniformLocation, rect.color.r, rect.color.g, rect.color.b, rect.color.a);

        // Bind position buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        setRectangle(this.gl, rect.position.x, rect.position.y, rect.width, rect.height); 
        this.gl.enableVertexAttribArray(this.fillPositionAttributeLocation);
        this.gl.vertexAttribPointer(this.fillPositionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Draw arrays
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    drawCircle(circle: Circle) {
        this.circles.push(circle);
    }

    drawTexCircle(circle: Circle) {
        if (!this.gl || !this.success) return;
        if (!this.texProgram) return;

        const { vertexCount: v } = circle;
        const radianInterval = (2 * Math.PI) / v;

        const vertices: number[] = [];
        for (let i = 0; i < v; i++) {
            
            // Explanation of calculation for circular clip 
            // path of the texture:
            //
            // Think of image as a clip space from 0.0 to 1.0 
            // in the x direction and from 0.0 to 1.0 in y 
            // direction going down, same with the window.
            //
            // Cosine and sine give the points around a 
            // circle that rotates clockwise in this case 
            // because the grid is reflected along the x axis.
            //
            // The center of the texture is always at (0.5, 0.5) 
            // while the other two points
            // are determined using the cosine and sine values of 
            // the triangular segment of the shape.
            //
            // The outside vectors must be shifted to fit the plane, 
            // since the center is translated to (0.5, 0.5), the 
            // outside points need to be divided by two,
            // since the window is now half the size, and then 
            // translated to (0.5, 0.5).
            vertices.push(
                0 + 0.5,
                0 + 0.5,
                Math.cos(radianInterval * i) / 2 + 0.5,
                Math.sin(radianInterval * i) / 2 + 0.5,
                Math.cos(radianInterval * ((i+1)%v)) / 2 + 0.5,
                Math.sin(radianInterval * ((i+1)%v)) / 2 + 0.5,
            );
        }

        // Use texture program
        this.gl.useProgram(this.texProgram);

        // Bind texture
        const tex = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, tex);

        // Set texture parameters to fill contents 
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        // Load the image into the texture
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, circle.textureInfo.image);

        // Bind position buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        setCircle(this.gl, circle);
        this.gl.enableVertexAttribArray(this.texPositionAttributeLocation);
        this.gl.vertexAttribPointer(this.texPositionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Bind texture coordinate buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Draw arrays
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 3 * circle.vertexCount);
    }

    displayCircle(circle: Circle) {
        if (!this.gl || !this.success) return;
        if (!this.fillProgram) return;

        this.gl.useProgram(this.fillProgram);

        // Set color uniform
        this.gl.uniform4f(this.colorUniformLocation, 0, 1, 0, 1);

        // Bind position buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        setCircle(this.gl, circle);
        this.gl.enableVertexAttribArray(this.fillPositionAttributeLocation);
        this.gl.vertexAttribPointer(this.fillPositionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Draw arrays
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 3 * circle.vertexCount);
    }

    display() {
        if (!this.gl || !this.success) return;
        for (const rect of this.rectangles) {
            if (rect.hasTexture) this.drawTexture(rect.textureInfo, rect.position); 
            else if (rect.hasFillColor) this.drawFilled(rect);
        } 
        for (const c of this.circles) {
            if (c.hasTexture) this.drawTexCircle(c);
            else this.displayCircle(c);
        }
        this.rectangles = [];
        this.circles = [];
    }
}

function createShader(
    gl: WebGLRenderingContext,
    type: any,
    source: any
) {
    const shader = gl.createShader(type);
    if (!shader) return;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(
    gl: WebGLRenderingContext, 
    vertexShader: any, 
    fragmentShader: any
) {
    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

function resizeCanvasToDisplaySize(canvas: any) {
  // Lookup the size the browser is displaying the canvas in CSS pixels.
  const displayWidth  = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
 
  // Check if the canvas is not the same size.
  const needResize = canvas.width  !== displayWidth ||
                     canvas.height !== displayHeight;
 
  if (needResize) {
    // Make the canvas the same size
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }
 
  return needResize;
}

function setRectangle(
    gl: WebGLRenderingContext,
    x: number,
    y: number,
    width: number,
    height: number
) {
    const x1 = x;
    const x2 = x + width;
    const y1 = y;
    const y2 = y + height;

    // bufferData will use the last used buffer which in this case
    // is the positionBuffer.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2
    ]), gl.STATIC_DRAW);
}

function setCircle(
    gl: WebGLRenderingContext,
    circle: Circle
) {
    const { x, y } = circle.position;
    const { x: xOrigin, y: yOrigin } = circle.relativeOrigin;
    const { radius: r, vertexCount: v } = circle;
    const radianInterval = (2 * Math.PI) / v;

    const vertices: number[] = [];
    for (let i = 0; i < v; i++) {
        vertices.push(
            0 + x + r - xOrigin,
            0 + y + r - yOrigin,
            Math.cos(radianInterval * i) * r + x + r - xOrigin,
            Math.sin(radianInterval * i) * r + y + r - yOrigin,
            Math.cos(radianInterval * ((i+1)%v)) * r + x + r - xOrigin,
            Math.sin(radianInterval * ((i+1)%v)) * r + y + r - yOrigin,
        );
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
}
