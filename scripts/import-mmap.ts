import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { MindNode, MindMapDocument } from '../types/node';

const SOURCE = resolve(process.cwd(), 'TasksRULI_23062026.mmap');
const OUTPUT = resolve(process.cwd(), 'data', 'mindmap.json');

function extractXml(): string {
  const zip = new AdmZip(SOURCE);
  const entry = zip.getEntry('Document.xml');
  if (!entry) throw new Error('Document.xml not found in archive');
  return zip.readAsText(entry);
}

interface XmlTopic {
  'ap:Text'?: { '@_PlainText'?: string } | Array<{ '@_PlainText'?: string }>;
  'ap:SubTopics'?: { 'ap:Topic'?: XmlTopic | XmlTopic[] };
}

function getText(topic: XmlTopic): string {
  const text = topic['ap:Text'];
  if (!text) return '(без названия)';
  if (Array.isArray(text)) return text[0]?.['@_PlainText'] ?? '(без названия)';
  return text['@_PlainText'] ?? '(без названия)';
}

function buildNode(topic: XmlTopic): MindNode {
  const name = getText(topic);
  const subtopics = topic['ap:SubTopics']?.['ap:Topic'];
  let children: MindNode[] = [];

  if (subtopics) {
    const arr = Array.isArray(subtopics) ? subtopics : [subtopics];
    children = arr.map(buildNode);
  }

  return {
    id: uuidv4(),
    name,
    description: null,
    responsible: null,
    status: null,
    deadline: null,
    children,
  };
}

function countNodes(node: MindNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

async function main() {
  console.log(`Читаю файл: ${SOURCE}`);

  const xml = extractXml();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'ap:Topic',
  });

  const parsed = parser.parse(xml);

  // Структура: ap:Map → ap:OneTopic → ap:Topic[] (массив из-за isArray)
  const mapNode = parsed['ap:Map'];
  const rootTopicRaw = mapNode?.['ap:OneTopic']?.['ap:Topic'];

  if (!rootTopicRaw) {
    throw new Error('Корневой узел не найден в XML');
  }

  // isArray делает ap:Topic массивом — берём первый элемент
  const rootTopic: XmlTopic = Array.isArray(rootTopicRaw) ? rootTopicRaw[0] : rootTopicRaw;
  const root = buildNode(rootTopic);
  const total = countNodes(root);

  const document: MindMapDocument = {
    version: '1.0',
    updatedAt: new Date().toISOString(),
    root,
  };

  writeFileSync(OUTPUT, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`✓ Импортировано узлов: ${total}`);
  console.log(`✓ Записано в: ${OUTPUT}`);
}

main().catch((err) => {
  console.error('Ошибка импорта:', err);
  process.exit(1);
});
