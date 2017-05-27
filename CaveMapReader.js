//
// Cavemap -> Survex converter
// author @aardgoose
//
// reads CAVEMAP '.CMP' data files and produces survex .svx output
//
// caveats 
//		output may require some editing to correct survex incompatible station names
//		splay legs may not be handled correctly yet
//

const fs = require('fs');
var DataView = require('buffer-dataview');

function CaveMapReader ( fileName ) {

	var i;

	var buffer = fs.readFileSync( fileName )
	var outfileName = fileName.replace( '.CMP', '.svx' );
	console.log( 'Coverting ', fileName, 'to ', outfileName );

	this.outFile = fs.openSync( outfileName, 'w' );

	this.source = new Buffer( buffer ); // file data as RW arrrayBuffer 
	this.pos = 0; // file position

	this.shotCount = 0;
	this.knownPointCount = 0;

	this.stations = [];
	this.knownPoints = [];
	this.lineNumber = 0;

	this.readHeader();

	// read shots

	for ( i = 0; i < this.shotCount; i++ ) {

		this.readShot( i );

	}

	for ( i = 0; i < this.knownPointCount; i++ ) {

		this.readKnownPoint( i );

	}

	fs.closeSync( this.outFile );

}

CaveMapReader.replace = function ( match ) {

	switch ( match ) {

		case ' ': return '_';
		case '.': return '_';
		case '/': return '-';
		case '\'': return '-';

		default:

			console.log( 'CMR: invalid character [', match, '] has no replacement' );
			return match;

	}

}

CaveMapReader.prototype.constructor = CaveMapReader;

CaveMapReader.prototype.writeLn = function () {

	var line = Array.prototype.slice.call( arguments ).join( ' ' ) + '\n';

	fs.writeSync( this.outFile, line );
	this.lineNumber++;

}

CaveMapReader.prototype.readHeader = function () {

	var f = new DataView( this.source, this.pos );

	// original names for these fields

	var o2 = f.getInt16( 0, true ); // number of known points
	var o5 = f.getInt16( 2, true ); // number of shots

	this.pos += 4;

	var title = this.readString( 30 );
	var notes = this.readString( 161 );

	// console.log( 'o2: ', o2 );

	var compassCorrection    = this.readFloat().toFixed( 2 );
	var clinometerCorrection = this.readFloat().toFixed( 2 );

	var startStation = this.readString( 10 );

	var easting   = this.readFloat().toFixed( 2 );
	var northing  = this.readFloat().toFixed( 2 );
	var elevation = this.readFloat().toFixed( 2 );

	this.writeLn( ';' );

	this.writeLn( '; CMR: export of data from Cavemap .cmp source file' );
	this.writeLn( '; CMR: converted at ', new Date().toGMTString() );

	this.writeLn( ';' );

	this.writeLn( '*title', '"', title, '"' );

	this.writeLn( ';' );

	this.writeLn( ';', notes );

	this.writeLn( ';' );

	this.writeLn( '*calibrate compass', compassCorrection );
	this.writeLn( '*calibrate clino', clinometerCorrection );

	this.writeLn( ';' );

	this.writeLn( '*fix ', startStation, easting, northing, elevation );

	this.writeLn( ';' );

	this.stations.push( startStation );

	this.shotCount = o5;
	this.knownPointCount = o2;

}

CaveMapReader.prototype.readShot = function ( shotIndex ) {

	var station = this.readString( 8 );
	var stationName;
	var fromIndex;
	var replaced = false;

	var distance   = this.readFloat().toFixed( 2 );
	var bearing    = this.readFloat().toFixed( 3 );
	var clinometer = this.readFloat().toFixed( 3 );

	var notes      = this.readString( 30 );

	var o4         = this.readFloat(); // indicates prev station ID + topology etc / fixed points

	var invalidName = /[^a-zA-Z0-9_\-]/g;

	if ( invalidName.test( station ) ) {

//		console.log( 'CMR: warning - invalid characters in station [', station, '] at line', this.lineNumber );

		stationName = station.replace( invalidName, CaveMapReader.replace );
		replaced = true;

	} else {

		stationName = station;

	}

	if ( Math.floor( o4 ) != o4 ) {

		this.knownPoints.push( station );

		o4 = Math.floor( o4 );

	}

	if ( o4 == 0 ) {

		fromIndex = shotIndex;

	} else if ( o4 > 5 ||  o4 < 0 ) {

		fromIndex = Math.abs( o4 ) - 6;

	} else if ( o4 == 3 || o4 == 1 ) {

		fromIndex = shotIndex;

	} else {

		console.error( 'line ', shotIndex, ' ****** error with unknown format o4 = ', o4 );
		//return;

	}

//	console.log( 'line', shotIndex, ' - ', this.stations[ fromIndex ], station, ' [ ', distance, bearing, clinometer , ' ] * o4 =', o4 );

	if ( notes ) {

		this.writeLn( this.stations[ fromIndex ], stationName, distance, bearing, clinometer, '; ', notes );

	} else {

		this.writeLn( this.stations[ fromIndex ], stationName, distance, bearing, clinometer );

	}

	if ( replaced ) this.writeLn( '; CMR: *** invalid characters in station name [', station, '] replaced with ', stationName, '***' );

	this.stations.push( stationName ); // save station name

}

CaveMapReader.prototype.readKnownPoint = function ( knownPointIndex ) {

	var station = this.knownPoints[ knownPointIndex ];

	var easting   = this.readFloat();
	var northing  = this.readFloat();
	var elevation = this.readFloat();

	this.writeLn( '*FIX ', station, easting, northing, elevation );

}

CaveMapReader.prototype.readFloat = function () {

	var dv = new DataView( this.source, this.pos );

	this.pos += 4;

	return dv.getFloat32( 0, true );

}

CaveMapReader.prototype.readString = function ( len ) {

	var db = [];
	var c;

	var bytes = new Uint8Array( this.source, this.pos );

	for ( var i = 0; i < len; i++ ) {

		c = bytes[ i + this.pos ];

		if ( c === 0 ) break;

		db.push( c );

	}

	this.pos += len;

	return String.fromCharCode.apply( null, db );

}

var files = fs.readdirSync( '.' );

var fileName, i, l;

for ( i = 0, l = files.length; i < l; i++ ) {

	var fileName = files[ i ];

	if ( ! /.*\.CMP$/.test( fileName ) ) continue;

	new CaveMapReader( fileName );

}


// EOF