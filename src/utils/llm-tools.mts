import { RAGApplicationBuilder } from '@llm-tools/embedjs'
import { LibSqlDb } from '@llm-tools/embedjs-libsql'
import { OpenAiEmbeddings } from '@llm-tools/embedjs-openai'

const databaseId = 'Ka6oYHpO6i8lc661uzIvl';
export const apiKey = 'sk-ykazxizngyvsyumhujzbrptexssizrzqcnehyymkimwiqqnt';
export const baseURL = 'https://api.siliconflow.cn/v1/';
const base = {
  id: databaseId,
  model: 'BAAI/bge-m3',
  dimensions: 1024,
  apiKey,
  apiVersion: undefined,
  baseURL,
  chunkSize: 8000,
  chunkOverlap: undefined,
};

const REFERENCE_PROMPT = `请根据参考资料回答问题，并使用脚注格式引用数据来源。请忽略无关的参考资料。

## 脚注格式：

1. **脚注标记**：在正文中使用 [^数字] 的形式标记脚注，例如 [^1]。
2. **脚注内容**：在文档末尾使用 [^数字]: 脚注内容 的形式定义脚注的具体内容
3. **脚注内容**：应该尽量简洁

## 我的问题是：

{question}

## 参考资料：

{references}
`;

const getRagApplication = async ({ model, apiKey, baseURL, dimensions }) => {
  const batchSize = 10;
  // const { RAGApplicationBuilder } = await import('@llm-tools/embedjs')
  // const { LibSqlDb } = await import('@llm-tools/embedjs-libsql')
  // const { OpenAiEmbeddings } = await import('@llm-tools/embedjs-openai')
  return new RAGApplicationBuilder()
    .setModel('NO_MODEL')
    .setEmbeddingModel(
      new OpenAiEmbeddings({
        model,
        apiKey,
        configuration: { baseURL },
        dimensions,
        batchSize,
      }),
    )
    .setVectorDatabase(
      new LibSqlDb({
        path: `${process.env.APPDATA}\\CherryStudioDev\\Data\\KnowledgeBase\\${databaseId}`,
      }),
    )
    .build();
};

export const searchForRag = async (question) => {
  const ragApplication = await getRagApplication(base);
  const result = await ragApplication.search(question);
  const references = result.slice(0, 6).map(
    (
      item,
      index,
    ) => {
      return {
        id: index,
        content: item.pageContent,
        // sourceUrl:
        //   'C:\\Users\\12196\\AppData\\Roaming\\CherryStudioDev\\Data\\Files\\25f29d19-7266-40a3-a04c-9bc322f12b4c.docx',
        // type: 'file'
      };
    },
  );
  const referencesContent = `\`\`\`json\n${JSON.stringify(references, null, 2)}\n\`\`\``;
  const content = REFERENCE_PROMPT.replace('{question}', question).replace('{references}', referencesContent);
  console.log('content', content);
  return content;
};
