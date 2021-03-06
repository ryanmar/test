define([
	'ribbon/ribbon-segment',
	'settings',
	'ribbon/global-events',
	'ribbon/ease',
	'ribbon/tween'
],function(RibbonSegment, settings, GlobalEvents, Ease, Tween){

	var SearchDirection = {
		LEFT: 0,
		RIGHT: 1
	};

	function Ribbon() {

		var self = this;
		self.drivePoint = 0.5;
		self.idleSpeed = 0.2;
		self.speed = self.idleSpeed;
		self.straightenStrength = 0;
		self.pullStrength = 0;
		self.pullSpread = 0;
		self.verticalPosition = 0.5;
		self.positionDamping = 0;
		self.canDestruct =  true;

		self.primaryColor = 1;
		self.secondaryColor = 0;

		var lastSegment = new RibbonSegment(null, self.primaryColor, self.secondaryColor);
		var firstSegment = lastSegment;
		var segmentPulled;
		var segments = {back: [], front: []};
		var totalSegmentLengthAtLastPull;
		var totalSegmentLength = 0;

		function getSegmentFromPullPoint(pullPoint) {
			for (var segment = lastSegment; segment;) {
				if (segment.endPoint.x / settings.dimensions.width < pullPoint || !segment.previousSegment) {
					return segment;
				}
				segment = segment.previousSegment;
			}
		}

		function advanceSegment(segment, anchorPoint) {
			// segment.setColor();
			segment.advance();
			segment.applyForces(anchorPoint);
		}

		self._construct = function() {
			self.createSegments();
			self.attachToRenderFrame();
		};

		self.advance = function() {
			self.move(self.speed);
			var segmentBeingPulled = getSegmentFromPullPoint(self.drivePoint);
			advanceSegment(segmentBeingPulled, settings.anchorPoints.CENTER);
			for (var segment = segmentBeingPulled.previousSegment; segment;) {
				advanceSegment(segment, settings.anchorPoints.END);
				segment = segment.previousSegment;
			}
			for (segment = segmentBeingPulled.nextSegment; segment;) {
				advanceSegment(segment, settings.anchorPoints.START);
				segment = segment.nextSegment;
			}

			for (segment = firstSegment; segment;) {
				segment.resetPolygon();
				segment = segment.nextSegment;
			}
			self.draw();
		};

		self.animateToTop = function(){
			var obj = {value: 0};
			new Tween(obj, 1200, {
				value: 1,
				ease: Ease.easeIn.sine,
				onUpdate: function() {
					// self.verticalPosition = 0.5 - 0.5 * tweenObj.value;
					// self.positionDamping = tweenObj.value;
					self.straightenStrength = obj.value;
					self.straighten();
				},
				onComplete: function() {}
			})
		};

		self.animateToBottom = function() {
			var obj = {value: 1};
			new Tween(obj, 1200, {
				value: 0,
				ease: Ease.easeIn.sine,
				onUpdate: function() {
					// self.verticalPosition = 0.5 - 0.5 * obj.value;
					// self.positionDamping = obj.value;
					self.straightenStrength = obj.value;
					self.straighten();
				},
				onComplete: function() {}
			});
		};

		self.attachToRenderFrame = function() {
			GlobalEvents.addListener(settings.RENDER_FRAME, self.advance);
		};

		self.detachFromRenderFrame = function() {
			GlobalEvents.removeListener(settings.RENDER_FRAME, self.advance);
		};

		self.clearPullPoint = function() {
			segmentPulled = null;
		};

		self.createSegments = function () {
			for (; lastSegment.endPoint.x < settings.dimensions.width + 600;) {
				segments[lastSegment.backface? 'back' : 'front'].push(lastSegment);
				totalSegmentLength += lastSegment.segmentLength;
				// currentSegment.width = self.width;
				// currentSegment.straightenStrength = Math.max(currentSegment.previousSegment.straightenStrength, self.pullStrength);
				lastSegment.applyForces(settings.anchorPoints.END);
				lastSegment = new RibbonSegment(lastSegment, self.primaryColor, self.secondaryColor);
			}

			for (; firstSegment.startPoint.x > -600;) {
				segments[firstSegment.backface? 'back' : 'front'].push(firstSegment);
				totalSegmentLength += firstSegment.segmentLength;
				// currentSegment.width = self.width;
				// currentSegment.straightenStrength = Math.max(currentSegment.previousSegment.straightenStrength, self.pullStrength);
				firstSegment.applyForces(settings.anchorPoints.END);
				firstSegment = new RibbonSegment(firstSegment, self.primaryColor, self.secondaryColor, true);
			}
			segments.back.forEach(function (segment) {
				settings.stage.addChild(segment.graphic);
			});

			segments.front.forEach(function (segment) {
				settings.stage.addChild(segment.graphic);
			});
		};

		function removeSegment(segment) {
			var list = segments[segment.backface ? 'back' : 'front'];
			for (var i = list.length; i >= 0; i--) {
				if (list[i] === segment) {
					list.splice(i,1);
				}
			}
		}

		self.destroySegments = function() {
			for (;firstSegment.endPoint.x < -600;) {
				totalSegmentLength -= firstSegment.segmentLength;
				firstSegment = firstSegment.nextSegment;
				removeSegment(firstSegment.previousSegment);
				firstSegment.previousSegment = null;
			}

			for (;lastSegment.startPoint.x > settings.dimensions.width + 600;) {
				totalSegmentLength -= lastSegment.segmentLength;
				lastSegment = lastSegment.previousSegment;
				removeSegment(lastSegment.nextSegment);
				lastSegment.nextSegment = null;
			}
		};

		self.draw = function () {
			segments.back.forEach(function (segment) {
				segment.draw();
			});

			segments.front.forEach(function (segment) {
				segment.draw();
			});
		};

		self.move = function(amount) {
			for (var segment = firstSegment; segment;) {
				segment.move(amount);
				segment = segment.nextSegment;
			}
			if (self.canDestruct) {
				self.destroySegments();
			}
			self.createSegments();
		};

		self.setPullPoint = function(pullPoint) {
			segmentPulled = getSegmentFromPullPoint(pullPoint);
			totalSegmentLengthAtLastPull = totalSegmentLength;
		};

		self.straighten = function() {
			// self.straightenStrength = Math.max(Math.min(self.straightenStrength, 1), 0);
			// self.width = self.collapsedRibbonWidth + (self.fullRibbonWidth - self.collapsedRibbonWidth) * (1 - self.straightenStrength);

			var segment = segmentPulled ? segmentPulled : getSegmentFromPullPoint(0.5);
			// segment.width = self.width;

			segment.straightenStrength = Math.min(self.straightenStrength + self.pullStrength, 1);
			segment.applyForces(settings.anchorPoints.CENTER);
			var pullStrength = 0, pullStrengthScale = 1;

			for (var seg = segment.nextSegment; seg;) {
				// seg.width = self.width;
				// if (self.pullSpread > 0) {
				// 	// the further away from the pull, the weaker the pull strength is
				// 	var distanceLvl = seg.distanceFromSegment(segment, SearchDirection.LEFT) / totalSegmentLengthAtLastPull;
				// 	var doublePullSpread = 2 * self.pullSpread,
				// 		quadrupleSpread = 2 * doublePullSpread;
				//
				// 	if(distanceLvl < doublePullSpread) {
				// 		pullStrengthScale = 1
				// 	} else if (distanceLvl > quadrupleSpread) {
				// 		pullStrengthScale = 0;
				// 	} else {
				// 		pullStrengthScale = 1 - (distanceLvl - doublePullSpread) / doublePullSpread;
				// 	}
				// }
				pullStrength = pullStrengthScale * self.pullStrength;

				seg.straightenStrength = Math.min(self.straightenStrength + pullStrength, 1);
				seg.applyForces(settings.anchorPoints.START);
				seg = seg.nextSegment;
			}
			for (seg = segment.previousSegment; seg;) {
				// seg.width = self.width;
				// distanceLvl = 1;
				// if (self.pullSpread > 0) {
				// 	distanceLvl = seg.distanceFromSegment(segment, SearchDirection.RIGHT) / totalSegmentLengthAtLastPull;
				// 	doublePullSpread = 2 * self.pullSpread;
				// 	quadrupleSpread = 2 * doublePullSpread;
				//
				// 	if(distanceLvl < doublePullSpread) {
				// 		pullStrengthScale = 1;
				// 	} else if (distanceLvl > quadrupleSpread) {
				// 		pullStrengthScale = 0;
				// 	} else {
				// 		pullStrengthScale = 1 - (distanceLvl - doublePullSpread) / (quadrupleSpread - doublePullSpread);
				// 	}
				//
				// }
				pullStrength = pullStrengthScale * self.pullStrength;

				seg.straightenStrength = Math.min(self.straightenStrength + pullStrength, 1);
				seg.applyForces(settings.anchorPoints.END);
				seg = seg.previousSegment;
			}
		};

		self._construct();
	}

	return Ribbon;

});