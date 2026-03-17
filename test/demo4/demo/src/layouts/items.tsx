import React from "react";
import { Outlet } from "umi";

interface ListItem {
  id: number;
  name: string;
  externalLink?: string;
  internalLink?: string;
}

const functionList: ListItem[] = [
  {
    id: 1,
    name: '学校官网',
    externalLink: 'https://www.zime.edu.cn/',
  },
  {
    id: 2,
    name: 'React',
    externalLink: 'https://zh-hans.react.dev/learn',
  },
  {
    id: 3,
    name: 'umi',
    externalLink: 'https://umijs.org',
  },
  {
    id: 4,
    name: 'TypeScript',
    externalLink: 'https://www.tslang.cn/#google_vignette'
  },
  {
    id: 5,
    name: 'game',
    internalLink: '/game',
  },
  {
    id: 6,
    name: 'personal',
    internalLink: '/system',
  },
];

export default function Items() {
  return {
    functionList
  }
}