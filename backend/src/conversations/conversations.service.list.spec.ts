// backend/src/conversations/conversations.service.list.spec.ts
// Liste « Messages » : chaque conversation dit avec qui on parle, ce qui s'est dit en dernier, combien de messages attendent
// d'être lus et sur quel itinéraire — sans jamais livrer l'identifiant d'un correspondant.
import { ConversationsService } from './conversations.service';

const T = new Date('2026-10-07T11:43:00.000Z');
const query = { skip: 0, take: 20, page: 1, limit: 20 };

const CITIES = { originCity: { name: 'Conakry' }, destinationCity: { name: 'Dakar' } };

const tripConversation = {
  id: 'cv-trip',
  bookingId: 'b1',
  shipmentId: null,
  customerId: 'cp1',
  driverId: 'dp1',
  createdAt: T,
  booking: { id: 'b1', tripId: 't1', trip: CITIES },
  shipment: null,
  customer: { userId: 'u-customer', firstName: 'Aïssatou', lastName: 'Bah' },
  driver: { userId: 'u-driver', firstName: 'Moustapha', lastName: 'Diallo' },
  messages: [{ content: 'Je suis devant la gare', sentAt: T, senderId: 'u-driver', isSupportIntervention: false }],
  _count: { messages: 2 },
};

const shipmentConversation = {
  id: 'cv-ship',
  bookingId: null,
  shipmentId: 's1',
  customerId: 'cp1',
  driverId: 'dp1',
  createdAt: T,
  booking: null,
  shipment: { id: 's1', senderName: 'Aïssatou Bah', recipientName: 'Mariama Sow', trip: null },
  customer: { userId: 'u-customer', firstName: 'Aïssatou', lastName: 'Bah' },
  driver: { userId: 'u-driver', firstName: 'Moustapha', lastName: 'Diallo' },
  messages: [],
  _count: { messages: 0 },
};

function build(rows: unknown[] = [tripConversation, shipmentConversation]) {
  const prisma = {
    conversation: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(rows.length),
    },
  };
  const service = new ConversationsService(prisma as never, {} as never);
  return { service, prisma };
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const list = async (service: ConversationsService, userId: string) =>
  (await service.findMine(userId, query as never)).data as Row[];

describe('ConversationsService.findMine — liste enrichie', () => {
  it('ne renvoie que les conversations dont l\'utilisateur est l\'une des deux parties', async () => {
    const { service, prisma } = build();
    await list(service, 'u-driver');
    expect(prisma.conversation.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ customer: { userId: 'u-driver' } }, { driver: { userId: 'u-driver' } }],
    });
  });

  it('le conducteur voit le nom du client, le client voit le nom du conducteur', async () => {
    const { service } = build();
    const asDriver = await list(service, 'u-driver');
    expect(asDriver[0].counterpart).toEqual({ firstName: 'Aïssatou', lastName: 'Bah' });
    const asCustomer = await list(service, 'u-customer');
    expect(asCustomer[0].counterpart).toEqual({ firstName: 'Moustapha', lastName: 'Diallo' });
  });

  it('aperçu du dernier message : « fromMe » dit si c\'est moi qui l\'ai écrit', async () => {
    const { service } = build();
    const asDriver = await list(service, 'u-driver');
    expect(asDriver[0].lastMessage).toEqual({ content: 'Je suis devant la gare', sentAt: T, fromMe: true, isSupportIntervention: false });
    const asCustomer = await list(service, 'u-customer');
    expect(asCustomer[0].lastMessage.fromMe).toBe(false);
  });

  it('conversation sans message : pas d\'aperçu (null), zéro non lu', async () => {
    const { service } = build();
    const rows = await list(service, 'u-customer');
    expect(rows[1].lastMessage).toBeNull();
    expect(rows[1].unreadCount).toBe(0);
  });

  it('compteur de non lus : seulement les messages de l\'autre partie, pas encore lus', async () => {
    const { service, prisma } = build();
    const rows = await list(service, 'u-customer');
    expect(rows[0].unreadCount).toBe(2);
    expect(prisma.conversation.findMany.mock.calls[0][0].include._count).toEqual({
      select: { messages: { where: { senderId: { not: 'u-customer' }, readAt: null } } },
    });
  });

  it('demande l\'itinéraire (villes) du trajet réservé ET du trajet lié à un envoi', async () => {
    const { service, prisma } = build();
    await list(service, 'u-customer');
    const { include } = prisma.conversation.findMany.mock.calls[0][0];
    const expected = { select: { originCity: { select: { name: true } }, destinationCity: { select: { name: true } } } };
    expect(include.booking).toEqual({ include: { trip: expected } });
    expect(include.shipment).toEqual({ include: { trip: expected } });
  });

  it('garde les champs historiques (anciennes versions de l\'app) et ajoute l\'itinéraire', async () => {
    const { service } = build();
    const [trip, shipment] = await list(service, 'u-customer');
    expect(trip).toMatchObject({ id: 'cv-trip', bookingId: 'b1', shipmentId: null, customerId: 'cp1', driverId: 'dp1', createdAt: T });
    expect(trip.booking.trip).toEqual(CITIES);
    expect(shipment.shipment).toMatchObject({ senderName: 'Aïssatou Bah', recipientName: 'Mariama Sow' });
  });

  it('ne livre jamais l\'identifiant utilisateur des parties ni les objets client / conducteur', async () => {
    const { service } = build();
    const rows = await list(service, 'u-customer');
    for (const row of rows) {
      expect(row.customer).toBeUndefined();
      expect(row.driver).toBeUndefined();
      expect(row.messages).toBeUndefined();
      expect(row._count).toBeUndefined();
      expect(JSON.stringify(row)).not.toContain('u-driver');
    }
  });

  it('renvoie le total et la pagination', async () => {
    const { service } = build();
    const result = await service.findMine('u-customer', query as never);
    expect(result.meta.total).toBe(2);
  });
});
