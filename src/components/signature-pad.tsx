"use client";

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "./ui/button";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
}

const SignaturePad = forwardRef<{ clear: () => void }, SignaturePadProps>(
  ({ onSave }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastX = useRef(0);
    const lastY = useRef(0);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size based on its container
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 200; // Fixed height

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const getCoords = (e: MouseEvent | TouchEvent) => {
        const canvasRect = canvas.getBoundingClientRect();
        if (e instanceof MouseEvent) {
          return { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
        } else {
          return { x: e.touches[0].clientX - canvasRect.left, y: e.touches[0].clientY - canvasRect.top };
        }
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const { x, y } = getCoords(e);
        [lastX.current, lastY.current] = [x, y];
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(lastX.current, lastY.current);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX.current, lastY.current] = [x, y];
      };

      const stopDrawing = () => {
        isDrawing.current = false;
      };

      canvas.addEventListener("mousedown", startDrawing);
      canvas.addEventListener("mousemove", draw);
      canvas.addEventListener("mouseup", stopDrawing);
      canvas.addEventListener("mouseout", stopDrawing);

      canvas.addEventListener("touchstart", startDrawing, { passive: false });
      canvas.addEventListener("touchmove", draw, { passive: false });
      canvas.addEventListener("touchend", stopDrawing);
      
      return () => {
        canvas.removeEventListener("mousedown", startDrawing);
        canvas.removeEventListener("mousemove", draw);
        canvas.removeEventListener("mouseup", stopDrawing);
        canvas.removeEventListener("mouseout", stopDrawing);

        canvas.removeEventListener("touchstart", startDrawing);
        canvas.removeEventListener("touchmove", draw);
        canvas.removeEventListener("touchend", stopDrawing);
      };
    }, []);

    const clearCanvas = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    
    useImperativeHandle(ref, () => ({
        clear: clearCanvas
    }));


    const handleSave = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        onSave(canvas.toDataURL("image/png"));
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <canvas
          ref={canvasRef}
          className="border rounded-lg bg-white cursor-crosshair touch-none"
        />
        <Button onClick={handleSave} className="w-full lift-button bg-gradient-to-r from-orange-500 to-amber-500 text-white">Save Signature</Button>
      </div>
    );
  }
);
SignaturePad.displayName = 'SignaturePad'

export default SignaturePad;
