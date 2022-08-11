import { z, ZodError } from 'zod';
import { createTopicMutation, topic } from '../../src/topic';
import { ExistingTopic } from '../../src/import';
import { VariablesType } from '@crystallize/js-api-client';
import { getTopicQuery } from '../../src/topic/queries/get';
import { updateTopicMutation } from '../../src/topic/mutations/update';
import { TopicSchema } from '../../src/schema/topic';

interface testCase {
    name: string;
    input: z.infer<typeof TopicSchema>;
    existingTopic?: ExistingTopic;
    expectedCalls?: { query: string; variables: VariablesType }[];
    error?: ZodError;
}

const testCases: testCase[] = [
    {
        name: 'Creates a simple topic',
        input: {
            name: 'Some Topic',
            parentId: 'some-parent-id',
            pathIdentifier: 'some-path-identifier',
        },
        expectedCalls: [
            createTopicMutation({
                language: 'en',
                input: {
                    tenantId: 'some-tenant-id',
                    name: 'Some Topic',
                    parentId: 'some-parent-id',
                    pathIdentifier: 'some-path-identifier',
                },
            }),
        ],
    },
    {
        name: 'Creates a simple topic with a small number of children',
        input: {
            name: 'Some Topic',
            parentId: 'some-parent-id',
            pathIdentifier: 'some-path-identifier',
            children: [
                {
                    name: 'Some Child 1',
                    pathIdentifier: 'some-child-1',
                    children: [
                        {
                            name: 'Some Grandchild 1',
                        },
                        {
                            name: 'Some Grandchild 2',
                        },
                    ],
                },
                {
                    name: 'Some Child 2',
                },
            ],
        },
        expectedCalls: [
            createTopicMutation({
                language: 'en',
                input: {
                    tenantId: 'some-tenant-id',
                    name: 'Some Topic',
                    parentId: 'some-parent-id',
                    pathIdentifier: 'some-path-identifier',
                    children: [
                        {
                            name: 'Some Child 1',
                            pathIdentifier: 'some-child-1',
                            children: [
                                {
                                    name: 'Some Grandchild 1',
                                },
                                {
                                    name: 'Some Grandchild 2',
                                },
                            ],
                        },
                        {
                            name: 'Some Child 2',
                        },
                    ],
                },
            }),
        ],
    },
    {
        name: 'Creates topics in batches when there are too many children for 1 query',
        input: {
            name: 'Some Topic',
            parentId: 'some-parent-id',
            pathIdentifier: 'some-path-identifier',
            children: [
                {
                    name: 'Some Child 1',
                    pathIdentifier: 'some-child-1',
                    children: new Array(100).fill('').map((_, i) => ({
                        name: `Some Grandchild ${i + 1}`,
                    })),
                },
                {
                    name: 'Some Child 2',
                    children: new Array(50).fill('').map((_, i) => ({
                        name: `Some Grandchild ${i + 1}`,
                    })),
                },
            ],
        },
        expectedCalls: [
            createTopicMutation({
                language: 'en',
                input: {
                    tenantId: 'some-tenant-id',
                    name: 'Some Topic',
                    parentId: 'some-parent-id',
                    pathIdentifier: 'some-path-identifier',
                    children: [],
                },
            }),
            createTopicMutation({
                language: 'en',
                input: {
                    tenantId: 'some-tenant-id',
                    parentId: 'some-id',
                    name: 'Some Child 1',
                    pathIdentifier: 'some-child-1',
                    children: [],
                },
            }),
            ...new Array(100).fill('').map((_, i) =>
                createTopicMutation({
                    language: 'en',
                    input: {
                        tenantId: 'some-tenant-id',
                        name: `Some Grandchild ${i + 1}`,
                        parentId: 'some-id',
                    },
                }),
            ),
            createTopicMutation({
                language: 'en',
                input: {
                    tenantId: 'some-tenant-id',
                    name: 'Some Child 2',
                    parentId: 'some-id',
                    children: new Array(50).fill('').map((_, i) => ({
                        name: `Some Grandchild ${i + 1}`,
                    })),
                },
            }),
        ],
    },
    {
        name: 'Updates a topic when topic.id is provided and the topic already exists',
        input: {
            id: 'some-topic-id',
            name: 'Some Topic',
            parentId: 'some-parent-id',
            pathIdentifier: 'some-path-identifier',
        },
        existingTopic: {
            id: 'some-topic-id',
        } as ExistingTopic,
        expectedCalls: [
            getTopicQuery({
                id: 'some-topic-id',
                language: 'en',
            }),
            updateTopicMutation({
                id: 'some-topic-id',
                language: 'en',
                input: {
                    name: 'Some Topic',
                    parentId: 'some-parent-id',
                    pathIdentifier: 'some-path-identifier',
                },
            }),
        ],
    },
    {
        name: 'Creates a topic when topic.id is provided and the topic does not already exist',
        input: {
            id: 'some-topic-id',
            name: 'Some Topic',
            parentId: 'some-parent-id',
            pathIdentifier: 'some-path-identifier',
        },
        expectedCalls: [
            getTopicQuery({
                id: 'some-topic-id',
                language: 'en',
            }),
            createTopicMutation({
                language: 'en',
                input: {
                    tenantId: 'some-tenant-id',
                    name: 'Some Topic',
                    parentId: 'some-parent-id',
                    pathIdentifier: 'some-path-identifier',
                },
            }),
        ],
    },
];

testCases.forEach((tc) =>
    it(tc.name, async () => {
        let mockPimApi = jest.fn().mockResolvedValue({
            topic: {
                create: {
                    id: 'some-id',
                },
            },
        });

        if (tc.existingTopic) {
            mockPimApi = mockPimApi.mockResolvedValueOnce({
                topic: {
                    get: tc.existingTopic,
                },
            });
        }

        const mockClient = {
            pimApi: mockPimApi,
            config: {
                tenantIdentifier: 'some-tenant-identifier',
                tenantId: 'some-tenant-id',
            },
        } as any;

        if (tc.error) {
            expect(await topic({ client: mockClient, language: 'en', topic: tc.input })).toThrow(tc.error);
            return;
        }

        if (!tc.expectedCalls?.length) {
            throw new Error('no expected mutations provided for test');
        }

        await topic({ client: mockClient, language: 'en', topic: tc.input });
        expect(mockPimApi).toHaveBeenCalledTimes(tc.expectedCalls.length);
        tc.expectedCalls.forEach(({ query, variables }, i) => {
            expect(mockPimApi).toHaveBeenNthCalledWith(i + 1, query, variables);
        });
    }),
);