import * as express from 'express';

export interface IRequest extends express.Request {
  id: string;
  now: number;
}
