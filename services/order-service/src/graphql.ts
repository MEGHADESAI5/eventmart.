import { listProducts } from "./inventoryClient";
import { placeOrder } from "./orderService";
import { getOrder, listOrders } from "./repo";

export const typeDefs = /* GraphQL */ `
  enum OrderStatus {
    PENDING
    CONFIRMED
    REJECTED
  }

  type Product {
    sku: String!
    name: String!
    stock: Int!
    unitPriceCents: Int!
  }

  type OrderItem {
    sku: String!
    quantity: Int!
    unitPriceCents: Int!
  }

  type Order {
    id: ID!
    customerId: String!
    status: OrderStatus!
    totalCents: Int!
    reason: String
    items: [OrderItem!]!
    createdAt: String!
  }

  input OrderItemInput {
    sku: String!
    quantity: Int!
  }

  input PlaceOrderInput {
    customerId: String!
    items: [OrderItemInput!]!
  }

  type Query {
    "Product catalogue, fetched from inventory-service over gRPC"
    products: [Product!]!
    order(id: ID!): Order
    orders(customerId: String, limit: Int = 20): [Order!]!
  }

  type Mutation {
    "Creates a PENDING order; inventory reservation happens asynchronously via Kafka"
    placeOrder(input: PlaceOrderInput!): Order!
  }
`;

export const resolvers = {
  Query: {
    products: () => listProducts(),
    order: (_: unknown, args: { id: string }) => getOrder(args.id),
    orders: (_: unknown, args: { customerId?: string | null; limit: number }) =>
      listOrders(args.customerId ?? null, args.limit),
  },
  Mutation: {
    placeOrder: (
      _: unknown,
      args: { input: { customerId: string; items: { sku: string; quantity: number }[] } },
    ) => placeOrder(args.input),
  },
};
