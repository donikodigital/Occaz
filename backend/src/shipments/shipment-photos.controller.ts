// backend/src/shipments/shipment-photos.controller.ts
// [19/10/2026] v1 — Routes des photos du colis, dans un contrôleur à part pour ne pas alourdir ShipmentsController :
//   POST /shipments/photos/upload-url  — le client demande où déposer une photo (avant de créer l'envoi) ;
//   GET  /shipments/:id/photos         — les photos de l'envoi (URL signées de 5 minutes).
// Les photos sont rattachées à l'envoi à sa création (champ `photoKeys` de POST /shipments), pas par une route séparée.
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { RequestParcelPhotoUploadDto } from './dto/request-parcel-photo-upload.dto';
import { ShipmentPhotosService } from './shipment-photos.service';

@ApiTags('Envois — photos du colis')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentPhotosController {
  constructor(private readonly photos: ShipmentPhotosService) {}

  @Post('photos/upload-url')
  @HttpCode(HttpStatus.OK)
  requestUploadUrl(@Body() dto: RequestParcelPhotoUploadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.photos.requestUploadUrl(user.id, dto);
  }

  @Get(':id/photos')
  list(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.photos.list(user, id);
  }
}
